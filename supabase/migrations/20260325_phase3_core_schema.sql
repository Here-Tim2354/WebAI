-- Phase 3.2
-- Core schema for first-batch database implementation:
-- public.profiles / public.conversations / public.messages

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'conversation_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.conversation_status as enum ('active', 'archived');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'message_sender_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.message_sender_type as enum ('user', 'assistant');
  end if;
end
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(100),
  avatar_url varchar(500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title varchar(100) not null,
  system_prompt text,
  status public.conversation_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_title_length_check check (char_length(title) between 1 and 100)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type public.message_sender_type not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint messages_content_not_blank check (char_length(trim(content)) > 0)
);

create index if not exists conversations_user_id_idx
  on public.conversations(user_id);

create index if not exists conversations_updated_at_idx
  on public.conversations(updated_at desc);

create index if not exists conversations_user_id_status_idx
  on public.conversations(user_id, status);

create index if not exists messages_conversation_id_idx
  on public.messages(conversation_id);

create index if not exists messages_created_at_idx
  on public.messages(created_at);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages(conversation_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute procedure public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own"
on public.conversations
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own"
on public.conversations
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own"
on public.conversations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own"
on public.conversations
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
on public.messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
);
