-- Remove the Phase 4.3 conversation search experiment.
-- Favorites and archive metadata remain in place.

drop function if exists public.search_user_conversations(
  text,
  uuid,
  public.conversation_status
);

drop table if exists public.search_records;
