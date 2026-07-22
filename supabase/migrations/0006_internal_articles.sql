-- Optimixed Exclusives: original, internally sourced articles.
--
-- An ingested ("external") post can be converted into an "internal" article.
-- Conversion creates a NEW post row rather than flipping the existing one, so
-- the external post keeps its identity + unique(source_id, url) and re-ingestion
-- can't resurrect it as a duplicate. The external post becomes source #1 of the
-- internal article and is hidden from the feed when the internal one publishes.

-- ------------------------------------------------------------------ --
-- posts: origin + original-article body
-- ------------------------------------------------------------------ --

alter table posts add column if not exists origin text not null default 'external';
alter table posts add column if not exists dek text;                    -- standfirst / one-line summary
alter table posts add column if not exists body_md text;                -- the article itself (markdown)
alter table posts add column if not exists converted_to_post_id uuid;   -- external -> its internal version
alter table posts add column if not exists generation_status text not null default 'idle';
alter table posts add column if not exists generation_error text;
alter table posts add column if not exists generation_started_at timestamptz;

alter table posts drop constraint if exists posts_origin_chk;
alter table posts add constraint posts_origin_chk check (origin in ('external', 'internal'));

alter table posts drop constraint if exists posts_generation_status_chk;
alter table posts add constraint posts_generation_status_chk check (
  generation_status in ('idle', 'planning', 'researching', 'verifying', 'drafting', 'ready', 'error')
);

alter table posts drop constraint if exists posts_converted_to_fk;
alter table posts add constraint posts_converted_to_fk
  foreign key (converted_to_post_id) references posts(id) on delete set null;

create index if not exists posts_origin_idx on posts (origin);
create index if not exists posts_converted_to_idx on posts (converted_to_post_id);

-- Rebuild the FTS vector so original article bodies are searchable (weight D).
-- Generated columns can't be altered in place; dropping it also drops its index.
drop index if exists posts_search_idx;
alter table posts drop column if exists search_vector;
alter table posts
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(tldr, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(dek, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body_md, '')), 'D')
  ) stored;
create index posts_search_idx on posts using gin (search_vector);

-- ------------------------------------------------------------------ --
-- Attributed sources for internal articles
-- ------------------------------------------------------------------ --

create table if not exists post_sources (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references posts(id) on delete cascade,

  kind           text not null default 'url'
                   check (kind in ('url', 'screenshot', 'note')),
  role           text not null default 'secondary'
                   check (role in ('primary', 'secondary', 'analysis')),

  url            text,        -- for kind='url'
  title          text,
  publisher      text,
  published_at   timestamptz,

  image_path     text,        -- storage object path (kind='screenshot')
  image_url      text,        -- public URL   (kind='screenshot')

  note           text,        -- admin context, or model-extracted content
  origin_post_id uuid references posts(id) on delete set null, -- when the source is one of our own posts

  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists post_sources_post_idx on post_sources (post_id, sort_order);

-- ------------------------------------------------------------------ --
-- Revision snapshots (taken before every regenerate, so a pass can be undone)
-- ------------------------------------------------------------------ --

create table if not exists post_revisions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  title      text,
  dek        text,
  body_md    text,
  note       text,           -- what produced this snapshot
  created_at timestamptz not null default now()
);

create index if not exists post_revisions_post_idx on post_revisions (post_id, created_at desc);

-- ------------------------------------------------------------------ --
-- The Optimixed "source" that owns internal articles
--   kind='internal' so the ingestion pipeline skips it, active=true so the
--   public RLS policy on sources still exposes the byline.
-- ------------------------------------------------------------------ --

alter table sources drop constraint if exists sources_kind_check;
alter table sources add constraint sources_kind_check check (kind in ('rss', 'sitemap', 'internal'));

insert into sources (slug, name, feed_url, kind, homepage_url, active)
values ('optimixed', 'Optimixed', '', 'internal', 'https://www.optimixed.com', true)
on conflict (slug) do nothing;

-- ------------------------------------------------------------------ --
-- Storage: screenshots and other uploaded source evidence
-- ------------------------------------------------------------------ --

insert into storage.buckets (id, name, public)
values ('article-sources', 'article-sources', true)
on conflict (id) do nothing;

drop policy if exists "public read article sources" on storage.objects;
create policy "public read article sources" on storage.objects
  for select using (bucket_id = 'article-sources');

-- ------------------------------------------------------------------ --
-- Row Level Security
--   post_sources are public for published internal articles (they're rendered
--   in the attribution block). Revisions stay service-role only.
-- ------------------------------------------------------------------ --

alter table post_sources   enable row level security;
alter table post_revisions enable row level security;

drop policy if exists "public read sources of published posts" on post_sources;
create policy "public read sources of published posts" on post_sources
  for select using (
    exists (
      select 1 from posts p
      where p.id = post_sources.post_id and p.status = 'published'
    )
  );
