export type PostStatus = "published" | "hidden" | "draft";
export type SourceKind = "rss" | "sitemap";

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
  updated_at: string;
}

/** Post joined with its source, category, and author for display. */
export interface PostWithRefs extends Post {
  source: Pick<Source, "id" | "slug" | "name"> | null;
  category: Pick<Category, "id" | "slug" | "name"> | null;
  author: Pick<Author, "id" | "slug" | "name"> | null;
}
