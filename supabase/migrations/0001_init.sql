-- Optimixed schema: sources → posts, with categories, authors, FTS, pgvector.
-- Apply in the Supabase SQL editor (or `supabase db push`).

create extension if not exists vector;

-- ------------------------------------------------------------------ --
-- Reference tables
-- ------------------------------------------------------------------ --

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists sources (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  feed_url        text not null,
  kind            text not null default 'rss' check (kind in ('rss', 'sitemap')),
  homepage_url    text,
  active          boolean not null default true,
  last_fetched_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists authors (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ --
-- Posts
-- ------------------------------------------------------------------ --

create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references sources(id) on delete cascade,
  category_id  uuid references categories(id) on delete set null,
  author_id    uuid references authors(id) on delete set null,

  -- identity / dedup
  guid         text,                        -- original feed <guid> / sitemap loc
  url          text not null,               -- canonical original article URL
  content_hash text,                        -- hash of normalized title+url for exact dedup
  dedup_group  uuid,                        -- cluster id: same story across sources

  -- our routing
  slug         text not null unique,        -- our URL slug (permalink)

  -- content
  title        text not null,
  tldr         text,                        -- AI one-liner
  summary      text,                        -- AI paragraph summary
  excerpt      text,                        -- original excerpt/first paragraphs
  image_url    text,
  lang         text not null default 'en',

  -- lifecycle
  published_at timestamptz,                 -- original publication time
  ingested_at  timestamptz not null default now(),
  status       text not null default 'published'
                 check (status in ('published', 'hidden', 'draft')),
  classified   boolean not null default false, -- has the AI assigned a category?

  -- semantic
  embedding    vector(1536),                -- dedup / related posts (nullable)

  updated_at   timestamptz not null default now(),

  unique (source_id, url)
);

-- Full-text search: weighted title > tldr > summary
alter table posts
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(tldr, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'C')
  ) stored;

-- ------------------------------------------------------------------ --
-- Indexes
-- ------------------------------------------------------------------ --

create index if not exists posts_published_idx on posts (published_at desc);
create index if not exists posts_status_idx     on posts (status);
create index if not exists posts_category_idx   on posts (category_id);
create index if not exists posts_source_idx     on posts (source_id);
create index if not exists posts_author_idx     on posts (author_id);
create index if not exists posts_guid_idx        on posts (source_id, guid);
create index if not exists posts_search_idx     on posts using gin (search_vector);
create index if not exists posts_embedding_idx
  on posts using hnsw (embedding vector_cosine_ops);

-- ------------------------------------------------------------------ --
-- updated_at trigger
-- ------------------------------------------------------------------ --

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sources_updated_at on sources;
create trigger sources_updated_at before update on sources
  for each row execute function set_updated_at();

drop trigger if exists posts_updated_at on posts;
create trigger posts_updated_at before update on posts
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------ --
-- Row Level Security
--   Public (anon key): read published posts + reference data only.
--   Admin/pipeline (service_role key): bypasses RLS entirely.
-- ------------------------------------------------------------------ --

alter table categories enable row level security;
alter table sources    enable row level security;
alter table authors    enable row level security;
alter table posts      enable row level security;

drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select using (true);

drop policy if exists "public read authors" on authors;
create policy "public read authors" on authors for select using (true);

-- Expose only active sources to the public (feed internals stay server-side via service role).
drop policy if exists "public read active sources" on sources;
create policy "public read active sources" on sources for select using (active = true);

drop policy if exists "public read published posts" on posts;
create policy "public read published posts" on posts
  for select using (status = 'published');
