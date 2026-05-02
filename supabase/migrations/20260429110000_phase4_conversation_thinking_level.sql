-- Conversation-level thinking control for Gemini 3 reasoning models.
-- Gemini 3 Flash cannot disable thinking entirely, so the lowest persisted level is minimal.
alter table public.conversations
  add column if not exists thinking_level text not null default 'minimal';

update public.conversations
set thinking_level = 'minimal'
where thinking_level is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_thinking_level_check'
      and conrelid = 'public.conversations'::regclass
  ) then
    alter table public.conversations
      add constraint conversations_thinking_level_check
      check (thinking_level in ('minimal', 'low', 'medium', 'high'));
  end if;
end $$;
