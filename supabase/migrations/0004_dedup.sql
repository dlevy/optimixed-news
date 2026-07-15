-- Deduplication hardening: title fingerprint, GUID uniqueness, and semantic
-- (embedding) matching for the same story across sources.

-- Layer 3: normalized-title fingerprint
alter table posts add column if not exists title_key text;
create index if not exists posts_title_key_idx on posts (title_key);

-- Layer 2: a feed GUID is unique within a source (independent of URL)
create unique index if not exists posts_source_guid_key
  on posts (source_id, guid) where guid is not null;

-- Layer 4: switch the embedding to 1024 dims (Voyage/OpenAI-compatible).
-- Column is empty, so drop + recreate is safe.
drop index if exists posts_embedding_idx;
alter table posts drop column if exists embedding;
alter table posts add column embedding vector(1024);
create index posts_embedding_idx on posts using hnsw (embedding vector_cosine_ops);

-- Semantic match helper: returns the closest existing post above a cosine
-- similarity threshold (optionally excluding one id, for backfill self-match).
create or replace function match_posts(
  query_embedding vector(1024),
  match_threshold float,
  exclude_id uuid default null
)
returns table (id uuid, source_id uuid, similarity float)
language sql stable as $$
  select p.id, p.source_id, 1 - (p.embedding <=> query_embedding) as similarity
  from posts p
  where p.embedding is not null
    and (exclude_id is null or p.id <> exclude_id)
    and 1 - (p.embedding <=> query_embedding) >= match_threshold
  order by p.embedding <=> query_embedding
  limit 1;
$$;
