alter table public.conversations
  add column if not exists web_search_enabled boolean not null default true;

update public.conversations
set web_search_enabled = true
where web_search_enabled is distinct from true;
