-- Working state for the newsroom pipeline.
--
-- Generation runs as a sequence of short steps (each one HTTP request, so each
-- gets its own serverless time budget). This column carries the plan, the
-- accumulated research notes, and the verified claims between those steps.

alter table posts add column if not exists generation_state jsonb not null default '{}'::jsonb;

-- 'refining' is a distinct stage: it revises existing copy against newly added
-- sources, rather than researching a story from scratch.
alter table posts drop constraint if exists posts_generation_status_chk;
alter table posts add constraint posts_generation_status_chk check (
  generation_status in
    ('idle', 'planning', 'researching', 'verifying', 'drafting', 'refining', 'ready', 'error')
);
