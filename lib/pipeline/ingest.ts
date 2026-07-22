import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import { fetchSource, type CandidateItem } from "@/lib/pipeline/fetch";
import { classifyArticle, type Classification } from "@/lib/pipeline/classify";
import { processThumbnail } from "@/lib/pipeline/image";
import { titleKey } from "@/lib/pipeline/normalize";
import { embedText, embeddingsEnabled, SIMILARITY_THRESHOLD } from "@/lib/pipeline/embeddings";
import type { Category, Source } from "@/lib/types";

const MAX_NEW_PER_SOURCE = 50;
const CLASSIFY_CONCURRENCY = 5;

/** Candidate annotated with its title fingerprint and normalized author slug. */
type Item = CandidateItem & { tkey: string; authorSlug: string | null };

/** An existing post that matched by title/semantics — carries what we need for
 *  the cross-source rule. */
type Match = { sourceId: string; authorSlug: string | null };
type TitleRow = { source_id: string; title_key: string; author: { slug: string } | null };

/**
 * A same-source match is always a duplicate. A cross-source match is a
 * duplicate only when the author is the same (syndicated content) — different
 * authors covering the same story are kept as separate posts.
 */
function isDuplicateMatch(matches: Match[], sourceId: string, authorSlug: string | null): boolean {
  return matches.some(
    (m) =>
      m.sourceId === sourceId ||
      (authorSlug !== null && m.authorSlug !== null && m.authorSlug === authorSlug),
  );
}

/** Run `fn` over items with bounded concurrency, preserving order. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface SourceResult {
  source: string;
  fetched: number;
  newItems: number;
  inserted: number;
  updated: number;
  error?: string;
}

export interface RunResult {
  ok: boolean;
  ranAt: string;
  results: SourceResult[];
  totals: { fetched: number; newItems: number; inserted: number; updated: number };
}

function shortHash(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 8);
}

function makeSlug(title: string, url: string): string {
  const base = slugify(title).slice(0, 80) || "post";
  return `${base}-${shortHash(url).slice(0, 6)}`;
}

/** Run ingestion for all active sources, or a single source by id. */
export async function runIngestion(opts: { sourceId?: string } = {}): Promise<RunResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — add it to .env.local (or your Vercel env) before running ingest.",
    );
  }

  const sb = getAdminSupabase();
  const ranAt = new Date().toISOString();

  const { data: cats } = await sb.from("categories").select("*").order("sort_order");
  const categories = (cats as Category[]) ?? [];
  const catIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  // kind='internal' is the Optimixed byline for original articles — never fetched.
  let sourceQuery = sb.from("sources").select("*").eq("active", true).neq("kind", "internal");
  if (opts.sourceId) sourceQuery = sb.from("sources").select("*").eq("id", opts.sourceId);
  const { data: srcData } = await sourceQuery;
  const sources = (srcData as Source[]) ?? [];

  const authorCache = new Map<string, string | null>();
  async function authorId(name: string | null): Promise<string | null> {
    if (!name) return null;
    const slug = slugify(name);
    if (!slug) return null;
    if (authorCache.has(slug)) return authorCache.get(slug)!;
    const { data: existing } = await sb.from("authors").select("id").eq("slug", slug).maybeSingle();
    let id = (existing as { id: string } | null)?.id ?? null;
    if (!id) {
      const { data: created } = await sb
        .from("authors")
        .insert({ slug, name })
        .select("id")
        .maybeSingle();
      id = (created as { id: string } | null)?.id ?? null;
    }
    authorCache.set(slug, id);
    return id;
  }

  const results: SourceResult[] = [];

  for (const source of sources) {
    const result: SourceResult = {
      source: source.name,
      fetched: 0,
      newItems: 0,
      inserted: 0,
      updated: 0,
    };
    try {
      const candidates = await fetchSource(source);
      result.fetched = candidates.length;
      const items: Item[] = candidates.map((c) => ({
        ...c,
        tkey: titleKey(c.title),
        authorSlug: c.author ? slugify(c.author) : null,
      }));

      // ---- Gather existing matches (canonical URL + GUID per source, title_key global) ----
      const urls = items.map((c) => c.url);
      const guids = items.map((c) => c.guid).filter((g): g is string => Boolean(g));
      const tkeys = items.map((c) => c.tkey);

      const [urlRes, guidRes, titleRes] = await Promise.all([
        sb.from("posts").select("id,url,title").eq("source_id", source.id).in("url", urls),
        guids.length
          ? sb.from("posts").select("id,guid,title").eq("source_id", source.id).in("guid", guids)
          : Promise.resolve({ data: [] as { id: string; guid: string; title: string }[] }),
        sb.from("posts").select("source_id,title_key,author:authors(slug)").in("title_key", tkeys),
      ]);
      const urlMap = new Map(
        ((urlRes.data as { id: string; url: string; title: string }[]) ?? []).map((r) => [r.url, r]),
      );
      const guidMap = new Map(
        ((guidRes.data as { id: string; guid: string; title: string }[]) ?? []).map((r) => [
          r.guid,
          r,
        ]),
      );
      // title_key → all posts sharing that headline (with source + author, for the cross-source rule)
      const titleMatches = new Map<string, Match[]>();
      for (const r of (titleRes.data as unknown as TitleRow[]) ?? []) {
        const arr = titleMatches.get(r.title_key) ?? [];
        arr.push({ sourceId: r.source_id, authorSlug: r.author?.slug ?? null });
        titleMatches.set(r.title_key, arr);
      }

      // ---- Partition: same-source updates vs new candidates ----
      const toUpdate: { id: string; item: Item }[] = [];
      const noMatch: Item[] = [];

      for (const item of items) {
        const sameSource = urlMap.get(item.url) ?? (item.guid ? guidMap.get(item.guid) : undefined);
        if (sameSource) {
          // Same article. Refresh it only if the source changed the title.
          if (sameSource.title.trim() !== item.title.trim()) toUpdate.push({ id: sameSource.id, item });
          continue;
        }
        // Same headline elsewhere: dup if same source (republish) or same author (syndication).
        const tMatches = titleMatches.get(item.tkey);
        if (tMatches && isDuplicateMatch(tMatches, source.id, item.authorSlug)) continue;
        noMatch.push(item);
      }

      // ---- Semantic (cross-source) check for the remaining, capped ----
      const toInsert: { item: Item; embedding: number[] | null }[] = [];
      for (const item of noMatch.slice(0, MAX_NEW_PER_SOURCE)) {
        let embedding: number[] | null = null;
        if (embeddingsEnabled()) {
          embedding = await embedText(`${item.title}\n${item.excerpt ?? ""}`);
          if (embedding) {
            const { data: sem } = await sb.rpc("match_posts", {
              query_embedding: embedding,
              match_threshold: SIMILARITY_THRESHOLD,
            });
            const matches = ((sem as { source_id: string; author_slug: string | null }[]) ?? []).map(
              (m): Match => ({ sourceId: m.source_id, authorSlug: m.author_slug }),
            );
            // Same story: dup if same source or same author; different author → keep both.
            if (isDuplicateMatch(matches, source.id, item.authorSlug)) continue;
          }
        }
        toInsert.push({ item, embedding });
      }
      result.newItems = toInsert.length;

      // Resolve authors first (sequential writes) to avoid races in concurrent build.
      for (const { item } of toInsert) await authorId(item.author);
      for (const { item } of toUpdate) await authorId(item.author);

      // ---- Insert new posts ----
      const rows = await mapPool(toInsert, CLASSIFY_CONCURRENCY, ({ item, embedding }) =>
        buildRow(sb, item, source, categories, catIdBySlug, authorId, embedding),
      );
      if (rows.length) {
        const { error, count } = await sb
          .from("posts")
          .upsert(rows, { onConflict: "source_id,url", ignoreDuplicates: true, count: "exact" });
        if (error) throw new Error(error.message);
        result.inserted = count ?? rows.length;
      }

      // ---- Update changed same-source posts ----
      for (const { id, item } of toUpdate) {
        await updatePost(sb, id, item, categories, catIdBySlug);
        result.updated++;
      }

      await sb.from("sources").update({ last_fetched_at: ranAt }).eq("id", source.id);
    } catch (e) {
      result.error = e instanceof Error ? e.message : "Unknown error";
    }
    results.push(result);
  }

  const totals = results.reduce(
    (acc, r) => ({
      fetched: acc.fetched + r.fetched,
      newItems: acc.newItems + r.newItems,
      inserted: acc.inserted + r.inserted,
      updated: acc.updated + r.updated,
    }),
    { fetched: 0, newItems: 0, inserted: 0, updated: 0 },
  );

  return { ok: results.every((r) => !r.error), ranAt, results, totals };
}

async function safeClassify(item: Item, categories: Category[]): Promise<Classification> {
  try {
    return await classifyArticle({ title: item.title, excerpt: item.excerpt }, categories);
  } catch {
    // Transient AI failure on one item — degrade to unclassified rather than losing the batch.
    return {
      categorySlug: null,
      secondaryCategorySlugs: [],
      articleType: null,
      importance: null,
      importanceReason: null,
      confidence: null,
      timeliness: null,
      tldr: item.title,
      summary: item.excerpt ?? "",
    };
  }
}

async function buildRow(
  sb: SupabaseClient,
  item: Item,
  source: Source,
  categories: Category[],
  catIdBySlug: Map<string, string>,
  authorId: (name: string | null) => Promise<string | null>,
  embedding: number[] | null,
) {
  const [classification, author, thumbnail] = await Promise.all([
    safeClassify(item, categories),
    authorId(item.author),
    processThumbnail(sb, item.imageUrl, item.url),
  ]);

  const categoryId = classification.categorySlug
    ? catIdBySlug.get(classification.categorySlug) ?? null
    : null;
  const secondaryIds = classification.secondaryCategorySlugs
    .map((s) => catIdBySlug.get(s))
    .filter((id): id is string => Boolean(id));

  return {
    source_id: source.id,
    category_id: categoryId,
    secondary_category_ids: secondaryIds,
    author_id: author,
    guid: item.guid,
    url: item.url,
    content_hash: shortHash(`${source.id}:${item.url}`),
    title_key: item.tkey,
    slug: makeSlug(item.title, item.url),
    title: item.title,
    tldr: classification.tldr,
    summary: classification.summary,
    excerpt: item.excerpt,
    image_url: item.imageUrl,
    thumbnail_url: thumbnail,
    embedding,
    article_type: classification.articleType,
    confidence: classification.confidence,
    timeliness: classification.timeliness,
    importance: classification.importance,
    importance_reason: classification.importanceReason,
    lang: "en",
    published_at: item.publishedAt,
    status: "published",
    classified: classification.categorySlug !== null,
  };
}

/** Refresh an existing same-source post whose title changed at the source. */
async function updatePost(
  sb: SupabaseClient,
  id: string,
  item: Item,
  categories: Category[],
  catIdBySlug: Map<string, string>,
) {
  const classification = await safeClassify(item, categories);
  const update: Record<string, unknown> = {
    title: item.title,
    tldr: classification.tldr,
    summary: classification.summary,
    title_key: item.tkey,
    secondary_category_ids: classification.secondaryCategorySlugs
      .map((s) => catIdBySlug.get(s))
      .filter((id): id is string => Boolean(id)),
    article_type: classification.articleType,
    confidence: classification.confidence,
    timeliness: classification.timeliness,
    importance: classification.importance,
    importance_reason: classification.importanceReason,
  };
  if (classification.categorySlug) {
    update.category_id = catIdBySlug.get(classification.categorySlug) ?? null;
    update.classified = true;
  }
  if (embeddingsEnabled()) {
    const emb = await embedText(`${item.title}\n${item.excerpt ?? ""}`);
    if (emb) update.embedding = emb;
  }
  await sb.from("posts").update(update).eq("id", id);
}
