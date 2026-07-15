-- Local thumbnails: a stored, resized image served from our own Storage bucket
-- (instead of hotlinking the source's server).

alter table posts add column if not exists thumbnail_url text;

-- Public bucket for resized thumbnails.
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Public read access to thumbnail objects (service_role writes bypass RLS).
drop policy if exists "public read thumbnails" on storage.objects;
create policy "public read thumbnails" on storage.objects
  for select using (bucket_id = 'thumbnails');
