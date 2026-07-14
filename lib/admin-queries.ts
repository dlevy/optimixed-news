import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Category, PostStatus, PostWithRefs, Source, SourceKind } from "@/lib/types";

const POST_SELECT =
  "*, source:sources(id,slug,name), category:categories(id,slug,name), author:authors(id,slug,name)";

// ---------- Dashboard stats ----------

export interface AdminStats {
  posts: number;
  published: number;
  hidden: number;
  unclassified: number;
  sources: number;
  activeSources: number;
}

export async function adminStats(): Promise<AdminStats> {
  const sb = getAdminSupabase();
  const count = async (
    table: string,
    filter?: { column: string; value: string | boolean },
  ) => {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter.column, filter.value);
    const { count: c } = await q;
    return c ?? 0;
  };
  const [posts, published, hidden, unclassified, sources, activeSources] = await Promise.all([
    count("posts"),
    count("posts", { column: "status", value: "published" }),
    count("posts", { column: "status", value: "hidden" }),
    count("posts", { column: "classified", value: false }),
    count("sources"),
    count("sources", { column: "active", value: true }),
  ]);
  return { posts, published, hidden, unclassified, sources, activeSources };
}

// ---------- Categories ----------

export async function adminListCategories(): Promise<Category[]> {
  const sb = getAdminSupabase();
  const { data } = await sb.from("categories").select("*").order("sort_order");
  return (data as Category[]) ?? [];
}

// ---------- Sources CRUD ----------

export async function adminListSources(): Promise<Source[]> {
  const sb = getAdminSupabase();
  const { data } = await sb.from("sources").select("*").order("name");
  return (data as Source[]) ?? [];
}

export interface SourceInput {
  name: string;
  slug: string;
  feed_url: string;
  kind: SourceKind;
  homepage_url?: string | null;
  active?: boolean;
}

export async function adminCreateSource(input: SourceInput): Promise<void> {
  const sb = getAdminSupabase();
  const { error } = await sb.from("sources").insert(input);
  if (error) throw new Error(error.message);
}

export async function adminUpdateSource(id: string, input: Partial<SourceInput>): Promise<void> {
  const sb = getAdminSupabase();
  const { error } = await sb.from("sources").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteSource(id: string): Promise<void> {
  const sb = getAdminSupabase();
  const { error } = await sb.from("sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Article moderation ----------

export interface AdminPostQuery {
  status?: PostStatus | "all";
  categoryId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function adminListPosts(q: AdminPostQuery = {}): Promise<PostWithRefs[]> {
  const sb = getAdminSupabase();
  const { limit = 50, offset = 0 } = q;
  let query = sb
    .from("posts")
    .select(POST_SELECT)
    .order("ingested_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q.status && q.status !== "all") query = query.eq("status", q.status);
  if (q.categoryId) query = query.eq("category_id", q.categoryId);
  if (q.search) query = query.textSearch("search_vector", q.search, { type: "websearch" });

  const { data } = await query;
  return (data as PostWithRefs[]) ?? [];
}

export async function adminSetPostStatus(id: string, status: PostStatus): Promise<void> {
  const sb = getAdminSupabase();
  const { error } = await sb.from("posts").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminSetPostCategory(id: string, categoryId: string | null): Promise<void> {
  const sb = getAdminSupabase();
  const { error } = await sb
    .from("posts")
    .update({ category_id: categoryId, classified: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
