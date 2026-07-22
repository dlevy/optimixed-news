export type PostStatus = "published" | "hidden" | "draft";
export type SourceKind = "rss" | "sitemap" | "internal";
export type PostOrigin = "external" | "internal";
export type GenerationStatus =
  | "idle"
  | "planning"
  | "researching"
  | "verifying"
  | "drafting"
  | "refining"
  | "ready"
  | "error";
export type SourceRefKind = "url" | "screenshot" | "note";
export type SourceRefRole = "primary" | "secondary" | "analysis";

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface Source {
  id: string;
  slug: string;
  name: string;
  feed_url: string;
  kind: SourceKind;
  homepage_url: string | null;
  active: boolean;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Author {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

export interface Post {
  id: string;
  source_id: string;
  category_id: string | null;
  author_id: string | null;
  guid: string | null;
  url: string;
  content_hash: string | null;
  dedup_group: string | null;
  slug: string;
  title: string;
  tldr: string | null;
  summary: string | null;
  excerpt: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  lang: string;
  published_at: string | null;
  ingested_at: string;
  status: PostStatus;
  classified: boolean;

  // Original ("Optimixed Exclusive") articles
  origin: PostOrigin;
  dek: string | null;
  body_md: string | null;
  converted_to_post_id: string | null;
  generation_status: GenerationStatus;
  generation_error?: string | null; // admin-only
  generation_started_at?: string | null; // admin-only

  // AI metadata
  secondary_category_ids: string[];
  article_type: string | null;
  confidence: string | null;
  timeliness: string | null;
  importance?: number | null; // admin-only (omitted from public queries)
  importance_reason?: string | null; // admin-only
  updated_at: string;
}

/** Post joined with its source, category, and author for display. */
export interface PostWithRefs extends Post {
  source: Pick<Source, "id" | "slug" | "name"> | null;
  category: Pick<Category, "id" | "slug" | "name"> | null;
  author: Pick<Author, "id" | "slug" | "name"> | null;
}

/** An attributed source backing an internal article. */
export interface PostSource {
  id: string;
  post_id: string;
  kind: SourceRefKind;
  role: SourceRefRole;
  url: string | null;
  title: string | null;
  publisher: string | null;
  published_at: string | null;
  image_path: string | null;
  image_url: string | null;
  note: string | null;
  origin_post_id: string | null;
  sort_order: number;
  created_at: string;
}

/** Snapshot of an article taken before a destructive regeneration pass. */
export interface PostRevision {
  id: string;
  post_id: string;
  title: string | null;
  dek: string | null;
  body_md: string | null;
  note: string | null;
  created_at: string;
}
