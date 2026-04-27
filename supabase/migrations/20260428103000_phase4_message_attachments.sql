-- Phase 4.4 message attachments and files capability rename

alter table public.gemini_models
  rename column supports_file_search to supports_files;

alter table public.openai_compatible_models
  rename column supports_file_search to supports_files;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'message_attachments',
  'message_attachments',
  false,
  20971520,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "message_attachments_select_own" on storage.objects;
create policy "message_attachments_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'message_attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "message_attachments_insert_own" on storage.objects;
create policy "message_attachments_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message_attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "message_attachments_delete_own" on storage.objects;
create policy "message_attachments_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'message_attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);
