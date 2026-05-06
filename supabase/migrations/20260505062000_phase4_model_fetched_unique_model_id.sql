-- Keep one user-side row per Gemini model id.
-- If duplicate rows already exist because the same model was fetched from
-- different base URLs, preserve one row and point conversations at it.

with ranked_duplicates as (
  select
    id,
    first_value(id) over (
      partition by user_id, model_id
      order by is_default desc, is_enabled desc, fetched_at desc, created_at asc, id asc
    ) as keep_id,
    row_number() over (
      partition by user_id, model_id
      order by is_default desc, is_enabled desc, fetched_at desc, created_at asc, id asc
    ) as row_rank
  from public.model_fetched
),
duplicate_rows as (
  select id, keep_id
  from ranked_duplicates
  where row_rank > 1
)
update public.conversations
set model_id = duplicate_rows.keep_id
from duplicate_rows
where conversations.model_id = duplicate_rows.id;

with ranked_duplicates as (
  select
    id,
    row_number() over (
      partition by user_id, model_id
      order by is_default desc, is_enabled desc, fetched_at desc, created_at asc, id asc
    ) as row_rank
  from public.model_fetched
)
delete from public.model_fetched
using ranked_duplicates
where model_fetched.id = ranked_duplicates.id
  and ranked_duplicates.row_rank > 1;

alter table public.model_fetched
  drop constraint if exists model_fetched_user_base_model_unique;

drop index if exists public.model_fetched_user_model_idx;

alter table public.model_fetched
  add constraint model_fetched_user_model_unique
  unique (user_id, model_id);
