-- Per-article AI metadata: secondary topics, article type, confidence,
-- timeliness, and an admin-only importance score.

alter table posts add column if not exists secondary_category_ids uuid[] not null default '{}';
alter table posts add column if not exists article_type text;
alter table posts add column if not exists confidence text;
alter table posts add column if not exists timeliness text;
alter table posts add column if not exists importance smallint;
alter table posts add column if not exists importance_reason text;

-- Value constraints (null allowed for unclassified/old rows).
alter table posts drop constraint if exists posts_article_type_chk;
alter table posts add constraint posts_article_type_chk check (
  article_type is null or article_type in
  ('news','opinion','analysis','guide','research','case-study','product-announcement','interview','roundup')
);

alter table posts drop constraint if exists posts_confidence_chk;
alter table posts add constraint posts_confidence_chk check (
  confidence is null or confidence in ('confirmed','speculation','opinion','rumor')
);

alter table posts drop constraint if exists posts_timeliness_chk;
alter table posts add constraint posts_timeliness_chk check (
  timeliness is null or timeliness in ('breaking','timely','evergreen')
);

alter table posts drop constraint if exists posts_importance_chk;
alter table posts add constraint posts_importance_chk check (
  importance is null or (importance >= 0 and importance <= 100)
);

create index if not exists posts_secondary_cats_idx on posts using gin (secondary_category_ids);
create index if not exists posts_article_type_idx on posts (article_type);
create index if not exists posts_importance_idx on posts (importance desc);
