-- Add official Gemini 3 Pro Preview to the internal Gemini capability catalog.

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
  'gemini-3-pro-preview',
  'Gemini 3 Pro Preview',
  'Gemini 3 Pro Preview：Gemini 3 系列高能力多模态思考模型，适合复杂推理、代码和长上下文任务。',
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
    "officialModelCode": "gemini-3-pro-preview",
    "officialDocs": "https://ai.google.dev/gemini-api/docs/models?hl=zh-cn"
  }'::jsonb,
  'catalog',
  false,
  false,
  15
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
  sort_order = excluded.sort_order;

update public.model_fetched
set
  label = catalog.label,
  description = catalog.description,
  icon = catalog.icon,
  input_token_limit = catalog.input_token_limit,
  output_token_limit = catalog.output_token_limit,
  capabilities = catalog.capabilities,
  catalog_id = catalog.id,
  source = 'catalog',
  sort_order = catalog.sort_order
from public.model_catalog as catalog
where public.model_fetched.model_id = 'gemini-3-pro-preview'
  and catalog.model_id = 'gemini-3-pro-preview';
