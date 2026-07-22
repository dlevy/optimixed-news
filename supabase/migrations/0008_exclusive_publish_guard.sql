-- Safety rail: an original article cannot be publicly visible unless it was
-- deliberately published.
--
-- adminPublishInternal always stamps published_at; conversion always leaves it
-- null. So requiring published_at on a published internal post means any other
-- write path that flips status to 'published' fails loudly instead of silently
-- putting unreviewed, AI-drafted copy on the site.

alter table posts drop constraint if exists posts_internal_publish_chk;
alter table posts add constraint posts_internal_publish_chk check (
  origin <> 'internal' or status <> 'published' or published_at is not null
);
