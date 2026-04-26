alter table public.messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.messages
  drop constraint if exists messages_metadata_object_check;

alter table public.messages
  add constraint messages_metadata_object_check
  check (jsonb_typeof(metadata) = 'object');
