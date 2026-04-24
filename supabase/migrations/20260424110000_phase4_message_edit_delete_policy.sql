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

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
on public.messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  )
);

create or replace function public.edit_user_message_and_delete_following(
  p_conversation_id uuid,
  p_message_id uuid,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception '请先登录后再继续。';
  end if;

  if char_length(trim(coalesce(p_content, ''))) = 0 then
    raise exception '消息不能为空。';
  end if;

  select messages.created_at
    into v_target_created_at
  from public.messages
  join public.conversations
    on conversations.id = messages.conversation_id
  where messages.id = p_message_id
    and messages.conversation_id = p_conversation_id
    and messages.sender_type = 'user'
    and conversations.user_id = auth.uid()
  for update of messages;

  if v_target_created_at is null then
    raise exception '消息不存在，或你没有访问权限。';
  end if;

  update public.messages
  set
    content = trim(p_content),
    status = 'complete'
  where id = p_message_id
    and conversation_id = p_conversation_id
    and sender_type = 'user';

  delete from public.messages
  where conversation_id = p_conversation_id
    and created_at > v_target_created_at;
end;
$$;

grant execute on function public.edit_user_message_and_delete_following(
  uuid,
  uuid,
  text
) to authenticated;
