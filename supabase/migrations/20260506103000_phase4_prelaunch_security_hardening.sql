-- Production hardening: remove obsolete privileged/write surfaces that are no
-- longer used by the Gemini-only runtime.

revoke execute on function public.edit_user_message_and_delete_following(
  uuid,
  uuid,
  text
) from authenticated;

drop function if exists public.edit_user_message_and_delete_following(
  uuid,
  uuid,
  text
);

revoke execute on function public.edit_user_message_metadata_and_delete_following(
  uuid,
  uuid,
  text,
  jsonb
) from public;

grant execute on function public.edit_user_message_metadata_and_delete_following(
  uuid,
  uuid,
  text,
  jsonb
) to authenticated;

drop policy if exists "ai_svgs_insert_fixed_svgs_anon" on storage.objects;
