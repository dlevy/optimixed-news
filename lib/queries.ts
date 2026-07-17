import { getSupabase } from "@/lib/supabase/server";
import type { Author, Category, PostWithRefs, Source } from "@/lib/types";

// Explicit public columns — importance/importance_reason (admin-only) and
// internal dedup fields are intentionally excluded from the public API.
const PUBLIC_COLS =
  "id,source_id,category_id,author_id,secondary_category_ids,slug,url,title,tldr,summary,excerpt," +
  "image_url,thumbnail_url,lang,published_at,ingested_at,status,classified,article_type,confidence,timeliness,updated_at";
const POST_SELECT =
  `${PUBLIC_COLS}, source:sources(id,slug,name), category:categories(id,slug,name), author:authors(id,slug,name)`;

// ---------- Reference lookups ----------

export async function getCategories(): Promise<Category[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.from("categories").select("*").order("sort_order");
  return (data as Category[]) ?? [];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("categories").select("*").eq("slug", slug).maybeSingle();
  return (data as Category) ?? null;
}

export async function getSources(): Promise<Source[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.from("sources").select("*").order("name");
  return (data as Source[]) ?? [];
}

export async function getSourceBySlug(slug: string): Promise<Source | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("sources").select("*").eq("slug", slug).maybeSingle();
  return (data as Source) ?? null;
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("authors").select("*").eq("slug", slug).maybeSingle();
  return (data as Author) ?? null;
}

// ---------- Posts ----------

export interface PostQuery {
  limit?: number;
  offset?: number;
  categoryId?: string;
  categoryIds?: string[]; // multi-select (home feed)
  sourceId?: string;
  authorId?: string;
  search?: string;
  dateStart?: string; // ISO inclusive
  dateEnd?: string; // ISO exclusive
  sort?: "latest" | "relevant";
  excludeRoundup?: boolean;
}

export async function getPosts(q: PostQuery = {}): Promise<PostWithRefs[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { limit = 24, offset = 0 } = q;

  let query = sb.from("posts").select(POST_SELECT).eq("status", "published");

  // "relevant" orders by the (admin-only) importance score, then recency.
  // Ordering by the column does not expose its value in the response.
  if (q.sort === "relevant") {
    query = query
      .order("importance", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("published_at", { ascending: false, nullsFirst: false });
  }
  query = query.range(offset, offset + limit - 1);

  if (q.categoryId) query = query.eq("category_id", q.categoryId);
  if (q.categoryIds && q.categoryIds.length) query = query.in("category_id", q.categoryIds);
  if (q.excludeRoundup) query = query.or("article_type.neq.roundup,article_type.is.null");
  if (q.sourceId) query = query.eq("source_id", q.sourceId);
  if (q.authorId) query = query.eq("author_id", q.authorId);
  if (q.dateStart) query = query.gte("published_at", q.dateStart);
  if (q.dateEnd) query = query.lt("published_at", q.dateEnd);
  if (q.search) query = query.textSearch("search_vector", q.search, { type: "websearch" });

  const { data } = await query;
  return (data as unknown as PostWithRefs[]) ?? [];
}

export async function getPostBySlug(slug: string): Promise<PostWithRefs | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("posts")
    .select(POST_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as unknown as PostWithRefs) ?? null;
}

/** Minimal post refs for the sitemap. */
export async function getSitemapPosts(
  limit = 5000,
): Promise<{ slug: string; updated_at: string }[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("posts")
    .select("slug,updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data as { slug: string; updated_at: string }[]) ?? [];
}

/** Published-at timestamps within a range — used to build the calendar heatmap. */
export async function getPostDatesInRange(startISO: string, endISO: string): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("posts")
    .select("published_at")
    .eq("status", "published")
    .gte("published_at", startISO)
    .lt("published_at", endISO)
    .not("published_at", "is", null)
    .limit(2000);
  return ((data as { published_at: string | null }[] | null) ?? [])
    .map((r) => r.published_at)
    .filter((d): d is string => Boolean(d));
}

/** Related posts in the same category (excludes the given post). */
export async function getRelatedPosts(post: PostWithRefs, limit = 4): Promise<PostWithRefs[]> {
  const sb = getSupabase();
  if (!sb || !post.category_id) return [];
  const { data } = await sb
    .from("posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .eq("category_id", post.category_id)
    .neq("id", post.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data as unknown as PostWithRefs[]) ?? [];
}
