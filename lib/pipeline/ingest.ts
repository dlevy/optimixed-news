import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import { fetchSource, type CandidateItem } from "@/lib/pipeline/fetch";
import { classifyArticle, type Classification } from "@/lib/pipeline/classify";
import { processThumbnail } from "@/lib/pipeline/image";
import type { Category, Source } from "@/lib/types";

const MAX_NEW_PER_SOURCE = 50;
const CLASSIFY_CONCURRENCY = 5;

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
  error?: string;
}

export interface RunResult {
  ok: boolean;
  ranAt: string;
  results: SourceResult[];
  totals: { fetched: number; newItems: number; inserted: number };
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

  let sourceQuery = sb.from("sources").select("*").eq("active", true);
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
    const result: SourceResult = { source: source.name, fetched: 0, newItems: 0, inserted: 0 };
    try {
      const candidates = await fetchSource(source);
      result.fetched = candidates.length;

      // Dedupe against existing posts for this source.
      const urls = candidates.map((c) => c.url);
      const { data: existingRows } = await sb
        .from("posts")
        .select("url")
        .eq("source_id", source.id)
        .in("url", urls);
      const existing = new Set((existingRows as { url: string }[] | null)?.map((r) => r.url) ?? []);

      const fresh = candidates.filter((c) => !existing.has(c.url)).slice(0, MAX_NEW_PER_SOURCE);
      result.newItems = fresh.length;

      // Resolve authors sequentially first (writes to the DB), so the concurrent
      // classify phase below never races on inserting the same author twice.
      for (const item of fresh) await authorId(item.author);

      const rows = await mapPool(fresh, CLASSIFY_CONCURRENCY, (item) =>
        buildRow(sb, item, source, categories, catIdBySlug, authorId),
      );

      if (rows.length) {
        const { error, count } = await sb
          .from("posts")
          .upsert(rows, { onConflict: "source_id,url", ignoreDuplicates: true, count: "exact" });
        if (error) throw new Error(error.message);
        result.inserted = count ?? rows.length;
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
    }),
    { fetched: 0, newItems: 0, inserted: 0 },
  );

  return { ok: results.every((r) => !r.error), ranAt, results, totals };
}

async function buildRow(
  sb: SupabaseClient,
  item: CandidateItem,
  source: Source,
  categories: Category[],
  catIdBySlug: Map<string, string>,
  authorId: (name: string | null) => Promise<string | null>,
) {
  const safeClassify = async (): Promise<Classification> => {
    try {
      return await classifyArticle({ title: item.title, excerpt: item.excerpt }, categories);
    } catch {
      // Transient AI failure on one item — degrade to unclassified rather than losing the batch.
      return { categorySlug: null, tldr: item.title, summary: item.excerpt ?? "" };
    }
  };

  const [classification, author, thumbnail] = await Promise.all([
    safeClassify(),
    authorId(item.author),
    processThumbnail(sb, item.imageUrl, item.url),
  ]);

  const categoryId = classification.categorySlug
    ? catIdBySlug.get(classification.categorySlug) ?? null
    : null;

  return {
    source_id: source.id,
    category_id: categoryId,
    author_id: author,
    guid: item.guid,
    url: item.url,
    content_hash: shortHash(`${source.id}:${item.url}`),
    slug: makeSlug(item.title, item.url),
    title: item.title,
    tldr: classification.tldr,
    summary: classification.summary,
    excerpt: item.excerpt,
    image_url: item.imageUrl,
    thumbnail_url: thumbnail,
    lang: "en",
    published_at: item.publishedAt,
    status: "published",
    classified: classification.categorySlug !== null,
  };
}
