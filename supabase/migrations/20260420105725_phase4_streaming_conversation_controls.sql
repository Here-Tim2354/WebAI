do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'message_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.message_status as enum (
      'pending',
      'streaming',
      'complete',
      'cancelled',
      'error'
    );
  end if;
end
$$;

alter table public.conversations
  add column if not exists model_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_model_id_fkey'
      and connamespace = 'public'::regnamespace
  ) then
    alter table public.conversations
      add constraint conversations_model_id_fkey
      foreign key (model_id)
      references public.ai_models(id)
      on delete set null;
  end if;
end
$$;

create index if not exists conversations_model_id_idx
  on public.conversations(model_id);

alter table public.messages
  add column if not exists status public.message_status not null default 'complete';

update public.messages
set status = 'complete'
where status is distinct from 'complete';

alter table public.messages
  drop constraint if exists messages_content_not_blank;

alter table public.messages
  add constraint messages_content_valid_check
  check (
    (
      sender_type = 'user'
      and status = 'complete'
      and char_length(trim(content)) > 0
    )
    or
    (
      sender_type = 'assistant'
      and (
        status in ('pending', 'streaming')
        or char_length(trim(content)) > 0
        or status in ('cancelled', 'error')
      )
    )
  );

drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own"
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
);
