-- Phase 4.3
-- Conversation organization: archive metadata, favorites, and title/message search.

create extension if not exists pg_trgm;

alter table public.conversations
  add column if not exists archived_at timestamptz;

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_user_conversation_unique unique (user_id, conversation_id)
);

create table if not exists public.search_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  active_conversation_id uuid references public.conversations(id) on delete set null,
  matched_conversation_ids uuid[] not null default '{}',
  result_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint search_records_query_not_blank check (char_length(trim(query)) between 1 and 200),
  constraint search_records_result_count_non_negative check (result_count >= 0)
);

create index if not exists conversations_user_id_status_updated_at_idx
  on public.conversations(user_id, status, updated_at desc);

create index if not exists conversations_archived_at_idx
  on public.conversations(archived_at desc)
  where archived_at is not null;

create index if not exists conversations_title_trgm_idx
  on public.conversations using gin (lower(title) gin_trgm_ops);

create index if not exists messages_content_trgm_idx
  on public.messages using gin (lower(content) gin_trgm_ops);

create index if not exists favorites_user_id_created_at_idx
  on public.favorites(user_id, created_at desc);

create index if not exists favorites_conversation_id_idx
  on public.favorites(conversation_id);

create index if not exists search_records_user_id_created_at_idx
  on public.search_records(user_id, created_at desc);

alter table public.favorites enable row level security;
alter table public.search_records enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
on public.favorites
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.conversations
    where conversations.id = favorites.conversation_id
      and conversations.user_id = auth.uid()
  )
);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
on public.favorites
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "search_records_select_own" on public.search_records;
create policy "search_records_select_own"
on public.search_records
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "search_records_insert_own" on public.search_records;
create policy "search_records_insert_own"
on public.search_records
for insert
to authenticated
with check (auth.uid() = user_id);

create or replace function public.search_user_conversations(
  p_query text,
  p_active_conversation_id uuid default null,
  p_status public.conversation_status default 'active'
)
returns table (
  id uuid,
  title varchar,
  system_prompt text,
  model_id uuid,
  web_search_enabled boolean,
  status public.conversation_status,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  is_favorite boolean,
  favorited_at timestamptz,
  match_rank integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_query text := lower(trim(p_query));
  current_user_id uuid := auth.uid();
  matched_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if normalized_query = '' or char_length(normalized_query) > 200 then
    raise exception 'Search query must be between 1 and 200 characters.';
  end if;

  drop table if exists pg_temp.phase4_search_matches;

  create temporary table phase4_search_matches on commit drop as
  select
    c.id,
    c.title,
    c.system_prompt,
    c.model_id,
    c.web_search_enabled,
    c.status,
    c.archived_at,
    c.created_at,
    c.updated_at,
    exists (
      select 1
      from public.favorites f
      where f.conversation_id = c.id
        and f.user_id = current_user_id
    ) as is_favorite,
    (
      select f.created_at
      from public.favorites f
      where f.conversation_id = c.id
        and f.user_id = current_user_id
      limit 1
    ) as favorited_at,
    case
      when c.id = p_active_conversation_id then 0
      when lower(c.title) like '%' || normalized_query || '%' then 1
      else 2
    end as match_rank
  from public.conversations c
  where c.user_id = current_user_id
    and c.status = p_status
    and (
      lower(c.title) like '%' || normalized_query || '%'
      or exists (
        select 1
        from public.messages m
        where m.conversation_id = c.id
          and lower(m.content) like '%' || normalized_query || '%'
      )
    );

  select coalesce(array_agg(phase4_search_matches.id), '{}')
  into matched_ids
  from phase4_search_matches;

  insert into public.search_records (
    user_id,
    query,
    active_conversation_id,
    matched_conversation_ids,
    result_count
  )
  values (
    current_user_id,
    trim(p_query),
    p_active_conversation_id,
    matched_ids,
    coalesce(array_length(matched_ids, 1), 0)
  );

  return query
  select
    phase4_search_matches.id,
    phase4_search_matches.title,
    phase4_search_matches.system_prompt,
    phase4_search_matches.model_id,
    phase4_search_matches.web_search_enabled,
    phase4_search_matches.status,
    phase4_search_matches.archived_at,
    phase4_search_matches.created_at,
    phase4_search_matches.updated_at,
    phase4_search_matches.is_favorite,
    phase4_search_matches.favorited_at,
    phase4_search_matches.match_rank
  from phase4_search_matches
  order by
    phase4_search_matches.match_rank asc,
    phase4_search_matches.updated_at desc;
end;
$$;
