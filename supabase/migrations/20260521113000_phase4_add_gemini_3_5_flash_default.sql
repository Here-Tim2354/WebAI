-- Add Gemini 3.5 Flash and promote it as the preferred default Gemini model.

update public.model_catalog
set
  is_default = false,
  updated_at = now()
where is_default = true;

insert into public.model_catalog (
  model_id,
  label,
  description,
  icon,
  input_token_limit,
  output_token_limit,
  capabilities,
  raw_metadata,
  source,
  default_enabled,
  is_default,
  sort_order
)
values (
  'gemini-3.5-flash',
  'Gemini 3.5 Flash',
  'Gemini 3.5 Flash：Gemini 3.5 系列快速多模态模型，适合日常聊天、代码、长上下文和多步 Agent 任务。',
  'https://ekswdwnxsugmtkdxfmnd.supabase.co/storage/v1/object/public/ai_svgs/gemini.svg',
  1048576,
  65536,
  '{
    "text": true,
    "image": true,
    "audio": true,
    "video": true,
    "webSearch": true,
    "googleSearch": true,
    "urlContext": true,
    "codeExecution": true,
    "functionCalling": true,
    "tools": true,
    "files": true,
    "structuredOutputs": true,
    "streaming": true,
    "reasoning": true
  }'::jsonb,
  '{
    "officialModelCode": "gemini-3.5-flash",
    "officialDocs": "https://ai.google.dev/gemini-api/docs/models",
    "modelCard": "https://deepmind.google/models/model-cards/gemini-3-5-flash/"
  }'::jsonb,
  'catalog',
  true,
  true,
  5
)
on conflict (model_id) do update
set
  label = excluded.label,
  description = excluded.description,
  icon = excluded.icon,
  input_token_limit = excluded.input_token_limit,
  output_token_limit = excluded.output_token_limit,
  capabilities = excluded.capabilities,
  raw_metadata = excluded.raw_metadata,
  source = excluded.source,
  default_enabled = excluded.default_enabled,
  is_default = excluded.is_default,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.model_catalog
set
  default_enabled = true,
  is_default = false,
  updated_at = now()
where model_id = 'gemini-3-flash-preview';

update public.model_fetched
set
  is_default = false,
  updated_at = now()
where is_default = true;

with catalog as (
  select *
  from public.model_catalog
  where model_id = 'gemini-3.5-flash'
),
existing_users as (
  select distinct user_id
  from public.model_fetched
)
insert into public.model_fetched (
  user_id,
  provider,
  api_style,
  base_url,
  model_id,
  label,
  description,
  icon,
  input_token_limit,
  output_token_limit,
  capabilities,
  raw_metadata,
  catalog_id,
  source,
  is_enabled,
  is_default,
  sort_order,
  fetched_at
)
select
  existing_users.user_id,
  catalog.provider,
  catalog.api_style,
  'https://generativelanguage.googleapis.com',
  catalog.model_id,
  catalog.label,
  catalog.description,
  catalog.icon,
  catalog.input_token_limit,
  catalog.output_token_limit,
  catalog.capabilities,
  jsonb_build_object('catalogModelId', catalog.model_id),
  catalog.id,
  'catalog',
  true,
  true,
  catalog.sort_order,
  now()
from existing_users
cross join catalog
on conflict (user_id, model_id) do update
set
  label = excluded.label,
  description = excluded.description,
  icon = excluded.icon,
  input_token_limit = excluded.input_token_limit,
  output_token_limit = excluded.output_token_limit,
  capabilities = excluded.capabilities,
  raw_metadata = excluded.raw_metadata,
  catalog_id = excluded.catalog_id,
  source = excluded.source,
  is_enabled = true,
  is_default = true,
  sort_order = excluded.sort_order,
  fetched_at = now(),
  updated_at = now();
