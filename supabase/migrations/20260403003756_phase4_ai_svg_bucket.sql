insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'ai_svgs',
  'ai_svgs',
  true,
  1048576,
  array['image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ai_svgs_insert_fixed_svgs_anon" on storage.objects;
create policy "ai_svgs_insert_fixed_svgs_anon"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'ai_svgs'
  and name in ('gemini.svg', 'openai.svg')
);
