import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import type {
  Category,
  PostRevision,
  PostSource,
  PostStatus,
  PostWithRefs,
  Source,
  SourceKind,
  SourceRefRole,
} from "@/lib/types";

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

/**
 * Ingestion feeds only. The Optimixed byline (kind='internal') is deliberately
 * excluded — it has no feed to manage, and deleting it would cascade away every
 * original article.
 */
export async function adminListSources(): Promise<Source[]> {
  const sb = getAdminSupabase();
  const { data } = await sb.from("sources").select("*").neq("kind", "internal").order("name");
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
  sort?: "recent" | "importance";
  limit?: number;
  offset?: number;
}

export async function adminListPosts(q: AdminPostQuery = {}): Promise<PostWithRefs[]> {
  const sb = getAdminSupabase();
  const { limit = 50, offset = 0 } = q;
  let query = sb.from("posts").select(POST_SELECT);

  if (q.sort === "importance") {
    query = query
      .order("importance", { ascending: false, nullsFirst: false })
      .order("ingested_at", { ascending: false });
  } else {
    query = query.order("ingested_at", { ascending: false });
  }
  query = query.range(offset, offset + limit - 1);

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

export async function adminGetPost(id: string): Promise<PostWithRefs | null> {
  const sb = getAdminSupabase();
  const { data } = await sb.from("posts").select(POST_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as PostWithRefs) ?? null;
}

// ---------- Internal ("Optimixed Exclusive") articles ----------

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.optimixed.com";
const INTERNAL_SOURCE_SLUG = "optimixed";

function uniqueSlug(title: string): string {
  const base = slugify(title).slice(0, 80) || "article";
  const suffix = createHash("sha1").update(randomUUID()).digest("hex").slice(0, 6);
  return `${base}-${suffix}`;
}

async function internalSourceId(): Promise<string> {
  const sb = getAdminSupabase();
  const { data } = await sb
    .from("sources")
    .select("id")
    .eq("slug", INTERNAL_SOURCE_SLUG)
    .maybeSingle();
  const id = (data as { id: string } | null)?.id;
  if (!id) {
    throw new Error(
      `The "${INTERNAL_SOURCE_SLUG}" source is missing — apply migration 0006_internal_articles.sql.`,
    );
  }
  return id;
}

/**
 * Convert an ingested article into an original Optimixed article.
 *
 * Creates a NEW draft post rather than mutating the external one: the external
 * row keeps its identity (so re-ingestion can't duplicate it) and becomes the
 * first attributed source of the new article. Idempotent — converting twice
 * returns the existing internal article.
 */
export async function adminConvertToInternal(externalId: string): Promise<string> {
  const sb = getAdminSupabase();

  const external = await adminGetPost(externalId);
  if (!external) throw new Error("Article not found.");
  if (external.origin === "internal") return external.id;
  if (external.converted_to_post_id) return external.converted_to_post_id;

  const slug = uniqueSlug(external.title);
  const { data: created, error } = await sb
    .from("posts")
    .insert({
      source_id: await internalSourceId(),
      category_id: external.category_id,
      author_id: null, // byline is Optimixed
      url: `${SITE_URL}/article/${slug}`,
      slug,
      title: external.title,
      origin: "internal",
      status: "draft",
      classified: external.classified,
      thumbnail_url: external.thumbnail_url,
      image_url: external.image_url,
      secondary_category_ids: external.secondary_category_ids,
      article_type: external.article_type,
      timeliness: external.timeliness,
      importance: external.importance ?? null,
      importance_reason: external.importance_reason ?? null,
      published_at: null, // set when it goes live
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const newId = (created as { id: string }).id;

  // The original coverage becomes source #1.
  await sb.from("post_sources").insert({
    post_id: newId,
    kind: "url",
    role: "primary",
    url: external.url,
    title: external.title,
    publisher: external.source?.name ?? null,
    published_at: external.published_at,
    origin_post_id: external.id,
    note: external.summary ?? external.tldr ?? null,
    sort_order: 0,
  });

  await sb.from("posts").update({ converted_to_post_id: newId }).eq("id", externalId);
  return newId;
}

export interface InternalArticleInput {
  title: string;
  dek: string | null;
  body_md: string | null;
  category_id: string | null;
  article_type: string | null;
  timeliness: string | null;
}

export async function adminUpdateInternalArticle(
  id: string,
  input: InternalArticleInput,
): Promise<void> {
  const sb = getAdminSupabase();
  const { error } = await sb
    .from("posts")
    .update({ ...input, tldr: input.dek })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Publish an internal article and retire the external original it came from,
 * so the feed carries the Optimixed version rather than both.
 */
export async function adminPublishInternal(id: string): Promise<void> {
  const sb = getAdminSupabase();
  const post = await adminGetPost(id);
  if (!post) throw new Error("Article not found.");
  if (!post.body_md?.trim()) throw new Error("Add some copy before publishing.");

  const { error } = await sb
    .from("posts")
    .update({ status: "published", published_at: post.published_at ?? new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await sb.from("posts").update({ status: "hidden" }).eq("converted_to_post_id", id);
}

export async function adminUnpublishInternal(id: string): Promise<void> {
  const sb = getAdminSupabase();
  await sb.from("posts").update({ status: "draft" }).eq("id", id);
  await sb.from("posts").update({ status: "published" }).eq("converted_to_post_id", id);
}

// ---------- Attributed sources ----------

export async function adminListPostSources(postId: string): Promise<PostSource[]> {
  const sb = getAdminSupabase();
  const { data } = await sb
    .from("post_sources")
    .select("*")
    .eq("post_id", postId)
    .order("sort_order")
    .order("created_at");
  return (data as PostSource[]) ?? [];
}

export interface PostSourceInput {
  kind: "url" | "screenshot" | "note";
  role: SourceRefRole;
  url?: string | null;
  title?: string | null;
  publisher?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  note?: string | null;
}

export async function adminAddPostSource(postId: string, input: PostSourceInput): Promise<void> {
  const sb = getAdminSupabase();
  const existing = await adminListPostSources(postId);
  const { error } = await sb
    .from("post_sources")
    .insert({ ...input, post_id: postId, sort_order: existing.length });
  if (error) throw new Error(error.message);
}

export async function adminDeletePostSource(id: string): Promise<void> {
  const sb = getAdminSupabase();
  const { data } = await sb
    .from("post_sources")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();
  const path = (data as { image_path: string | null } | null)?.image_path;
  if (path) await sb.storage.from("article-sources").remove([path]);
  const { error } = await sb.from("post_sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Store an uploaded screenshot and return its storage path + public URL. */
export async function adminUploadSourceImage(
  postId: string,
  file: File,
): Promise<{ path: string; url: string }> {
  const sb = getAdminSupabase();
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${postId}/${randomUUID()}.${ext || "png"}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await sb.storage
    .from("article-sources")
    .upload(path, bytes, { contentType: file.type || "image/png", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = sb.storage.from("article-sources").getPublicUrl(path);
  return { path, url: data.publicUrl };
}

// ---------- Revisions ----------

export async function adminListRevisions(postId: string): Promise<PostRevision[]> {
  const sb = getAdminSupabase();
  const { data } = await sb
    .from("post_revisions")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as PostRevision[]) ?? [];
}

/** Snapshot the current copy before a destructive change. */
export async function adminSnapshotRevision(postId: string, note: string): Promise<void> {
  const sb = getAdminSupabase();
  const post = await adminGetPost(postId);
  if (!post) return;
  await sb.from("post_revisions").insert({
    post_id: postId,
    title: post.title,
    dek: post.dek,
    body_md: post.body_md,
    note,
  });
}

export async function adminRestoreRevision(revisionId: string): Promise<string> {
  const sb = getAdminSupabase();
  const { data } = await sb.from("post_revisions").select("*").eq("id", revisionId).maybeSingle();
  const rev = data as PostRevision | null;
  if (!rev) throw new Error("Revision not found.");

  await adminSnapshotRevision(rev.post_id, "Before restoring an earlier version");
  const { error } = await sb
    .from("posts")
    .update({ title: rev.title, dek: rev.dek, body_md: rev.body_md, tldr: rev.dek })
    .eq("id", rev.post_id);
  if (error) throw new Error(error.message);
  return rev.post_id;
}
