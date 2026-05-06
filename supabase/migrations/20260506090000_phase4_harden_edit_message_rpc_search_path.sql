-- Harden the edit RPC against search_path hijacking while preserving the
-- current attachment and URL-only edit contract.

alter table public.messages
  drop constraint if exists messages_content_valid_check;

alter table public.messages
  add constraint messages_content_valid_check
  check (
    (
      sender_type = 'user'
      and status = 'complete'
      and (
        char_length(trim(content)) > 0
        or (
          jsonb_typeof(metadata -> 'attachments') = 'array'
          and jsonb_array_length(metadata -> 'attachments') > 0
        )
        or (
          jsonb_typeof(metadata -> 'urls') = 'array'
          and jsonb_array_length(metadata -> 'urls') > 0
        )
      )
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

create or replace function public.edit_user_message_metadata_and_delete_following(
  p_conversation_id uuid,
  p_message_id uuid,
  p_content text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_created_at timestamptz;
  v_next_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_attachment_count integer := 0;
  v_url_count integer := 0;
begin
  if auth.uid() is null then
    raise exception '请先登录后再继续。';
  end if;

  if jsonb_typeof(v_next_metadata) <> 'object' then
    raise exception '消息 metadata 必须是对象。';
  end if;

  if jsonb_typeof(v_next_metadata -> 'attachments') = 'array' then
    v_attachment_count := jsonb_array_length(v_next_metadata -> 'attachments');
  end if;

  if jsonb_typeof(v_next_metadata -> 'urls') = 'array' then
    v_url_count := jsonb_array_length(v_next_metadata -> 'urls');
  end if;

  if char_length(trim(coalesce(p_content, ''))) = 0
    and v_attachment_count = 0
    and v_url_count = 0 then
    raise exception '消息正文和附加项至少需要保留一个。';
  end if;

  select m.created_at
    into v_target_created_at
  from public.messages as m
  join public.conversations as c
    on c.id = m.conversation_id
  where m.id = p_message_id
    and m.conversation_id = p_conversation_id
    and m.sender_type = 'user'
    and c.user_id = auth.uid()
  for update of m;

  if v_target_created_at is null then
    raise exception '消息不存在，或你没有访问权限。';
  end if;

  update public.messages
  set
    content = trim(coalesce(p_content, '')),
    metadata = v_next_metadata,
    status = 'complete'
  where id = p_message_id
    and conversation_id = p_conversation_id
    and sender_type = 'user';

  delete from public.messages
  where conversation_id = p_conversation_id
    and created_at > v_target_created_at;
end;
$$;

grant execute on function public.edit_user_message_metadata_and_delete_following(
  uuid,
  uuid,
  text,
  jsonb
) to authenticated;
