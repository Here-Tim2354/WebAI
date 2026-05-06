-- Phase 4 Gemini model catalog and user-fetched model registry
-- Boundary:
-- - Clear old conversation model references.
-- - Replace ai_models / gemini_models with model_catalog / model_fetched.
-- - Keep user, conversation, message and attachment data intact.

update public.conversations
set model_id = null
where model_id is not null;

alter table public.conversations
  drop constraint if exists conversations_model_id_fkey;

drop policy if exists "gemini_models_select_enabled" on public.gemini_models;
drop trigger if exists set_gemini_models_updated_at on public.gemini_models;
drop table if exists public.gemini_models cascade;

drop policy if exists "ai_models_select_enabled" on public.ai_models;
drop trigger if exists set_ai_models_updated_at on public.ai_models;
drop table if exists public.ai_models cascade;

create table if not exists public.model_catalog (
  id uuid primary key default gen_random_uuid(),
  provider varchar(50) not null default 'gemini',
  api_style varchar(50) not null default 'gemini_native',
  model_id varchar(160) not null unique,
  label varchar(160) not null,
  description text,
  icon text,
  input_token_limit integer,
  output_token_limit integer,
  capabilities jsonb not null default '{}'::jsonb,
  raw_metadata jsonb not null default '{}'::jsonb,
  source varchar(50) not null default 'catalog',
  default_enabled boolean not null default false,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_catalog_provider_check
    check (provider = 'gemini'),
  constraint model_catalog_api_style_check
    check (api_style = 'gemini_native'),
  constraint model_catalog_capabilities_object_check
    check (jsonb_typeof(capabilities) = 'object'),
  constraint model_catalog_raw_metadata_object_check
    check (jsonb_typeof(raw_metadata) = 'object')
);

create index if not exists model_catalog_default_enabled_idx
  on public.model_catalog(default_enabled, sort_order, label);

create unique index if not exists model_catalog_single_default_idx
  on public.model_catalog(is_default)
  where is_default = true;

drop trigger if exists set_model_catalog_updated_at on public.model_catalog;
create trigger set_model_catalog_updated_at
before update on public.model_catalog
for each row execute procedure public.set_updated_at();

alter table public.model_catalog enable row level security;

create table if not exists public.model_fetched (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider varchar(50) not null default 'gemini',
  api_style varchar(50) not null default 'gemini_native',
  base_url text not null default 'https://generativelanguage.googleapis.com',
  model_id varchar(160) not null,
  label varchar(160) not null,
  description text,
  icon text,
  input_token_limit integer,
  output_token_limit integer,
  capabilities jsonb not null default '{}'::jsonb,
  raw_metadata jsonb not null default '{}'::jsonb,
  catalog_id uuid,
  source varchar(50) not null default 'catalog',
  is_enabled boolean not null default false,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_fetched_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete cascade,
  constraint model_fetched_catalog_id_fkey
    foreign key (catalog_id)
    references public.model_catalog(id)
    on delete set null,
  constraint model_fetched_provider_check
    check (provider = 'gemini'),
  constraint model_fetched_api_style_check
    check (api_style = 'gemini_native'),
  constraint model_fetched_base_url_check
    check (base_url ~ '^https?://'),
  constraint model_fetched_capabilities_object_check
    check (jsonb_typeof(capabilities) = 'object'),
  constraint model_fetched_raw_metadata_object_check
    check (jsonb_typeof(raw_metadata) = 'object'),
  constraint model_fetched_user_base_model_unique
    unique (user_id, base_url, model_id)
);

create index if not exists model_fetched_user_enabled_idx
  on public.model_fetched(user_id, is_enabled, sort_order, label);

create index if not exists model_fetched_user_model_idx
  on public.model_fetched(user_id, model_id);

create unique index if not exists model_fetched_single_default_per_user_idx
  on public.model_fetched(user_id)
  where is_default = true and is_enabled = true;

drop trigger if exists set_model_fetched_updated_at on public.model_fetched;
create trigger set_model_fetched_updated_at
before update on public.model_fetched
for each row execute procedure public.set_updated_at();

alter table public.model_fetched enable row level security;

drop policy if exists "model_fetched_select_own" on public.model_fetched;
create policy "model_fetched_select_own"
on public.model_fetched
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "model_fetched_insert_own" on public.model_fetched;
create policy "model_fetched_insert_own"
on public.model_fetched
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "model_fetched_update_own" on public.model_fetched;
create policy "model_fetched_update_own"
on public.model_fetched
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "model_fetched_delete_own" on public.model_fetched;
create policy "model_fetched_delete_own"
on public.model_fetched
for delete
to authenticated
using (user_id = auth.uid());

alter table public.conversations
  add constraint conversations_model_id_fkey
  foreign key (model_id)
  references public.model_fetched(id)
  on delete set null;

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
values
  (
    'gemini-3-flash-preview',
    'Gemini 3 Flash Preview',
    'Gemini 3 Flash Preview：Gemini 3 系列均衡模型，支持文本、图像、音频、视频与 PDF 输入，适合主聊天链路。',
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
    '{"officialModelCode": "gemini-3-flash-preview"}'::jsonb,
    'catalog',
    true,
    true,
    10
  ),
  (
    'gemini-3.1-pro-preview',
    'Gemini 3.1 Pro Preview',
    'Gemini 3.1 Pro Preview：Gemini 3.1 系列高能力模型，适合复杂推理、代码和多步工具任务。',
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
    '{"officialModelCode": "gemini-3.1-pro-preview"}'::jsonb,
    'catalog',
    true,
    false,
    20
  ),
  (
    'gemini-3.1-flash-lite-preview',
    'Gemini 3.1 Flash-Lite Preview',
    'Gemini 3.1 Flash-Lite Preview：Gemini 3.1 系列轻量模型，适合高频、低延迟、低成本任务。',
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
    '{"officialModelCode": "gemini-3.1-flash-lite-preview"}'::jsonb,
    'catalog',
    true,
    false,
    30
  ),
  (
    'gemini-2.5-pro',
    'Gemini 2.5 Pro',
    'Gemini 2.5 Pro：稳定版高能力思考模型，适合复杂任务和长上下文。',
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
    '{"officialModelCode": "gemini-2.5-pro"}'::jsonb,
    'catalog',
    false,
    false,
    40
  ),
  (
    'gemini-2.5-flash',
    'Gemini 2.5 Flash',
    'Gemini 2.5 Flash：稳定版高性价比模型，适合低延迟和大规模处理。',
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
    '{"officialModelCode": "gemini-2.5-flash"}'::jsonb,
    'catalog',
    false,
    false,
    50
  ),
  (
    'gemini-2.5-flash-lite',
    'Gemini 2.5 Flash-Lite',
    'Gemini 2.5 Flash-Lite：稳定版轻量多模态模型，适合低成本高吞吐任务。',
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
    '{"officialModelCode": "gemini-2.5-flash-lite"}'::jsonb,
    'catalog',
    false,
    false,
    60
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
