-- Phase 4 model registry parent-child final schema
-- Final destructive rebuild:
-- 1. Create public.ai_models as the shared parent registry table.
-- 2. Drop and rebuild public.openai_compatible_models / public.gemini_models as provider child tables.
-- 3. Child tables keep only provider-specific fields; shared metadata moves to public.ai_models.

create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider varchar(50) not null,
  api_style varchar(50) not null,
  upstream_model_id varchar(160) not null,
  label varchar(160) not null,
  description text,
  icon text,
  is_enabled boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_models_provider_check
    check (provider in ('openai_compatible', 'gemini')),
  constraint ai_models_provider_upstream_unique
    unique (provider, upstream_model_id)
);

create index if not exists ai_models_enabled_idx
  on public.ai_models(is_enabled);

create index if not exists ai_models_sort_order_idx
  on public.ai_models(sort_order, label);

create unique index if not exists ai_models_default_per_provider_unique_idx
  on public.ai_models(provider)
  where is_default = true;

drop trigger if exists set_ai_models_updated_at on public.ai_models;
create trigger set_ai_models_updated_at
before update on public.ai_models
for each row execute procedure public.set_updated_at();

alter table public.ai_models enable row level security;

drop policy if exists "ai_models_select_enabled" on public.ai_models;
create policy "ai_models_select_enabled"
on public.ai_models
for select
to authenticated
using (is_enabled = true);

drop policy if exists "openai_compatible_models_select_enabled" on public.openai_compatible_models;
drop policy if exists "gemini_models_select_enabled" on public.gemini_models;

drop trigger if exists set_openai_compatible_models_updated_at on public.openai_compatible_models;
drop trigger if exists set_gemini_models_updated_at on public.gemini_models;

drop table if exists public.openai_compatible_models cascade;
drop table if exists public.gemini_models cascade;

create table public.openai_compatible_models (
  id uuid primary key default gen_random_uuid(),
  ai_model_id uuid not null unique,
  model_id varchar(160) not null unique,
  base_url text,
  supports_text boolean not null default true,
  supports_image boolean not null default false,
  supports_audio boolean not null default false,
  supports_video boolean not null default false,
  supports_web_search boolean not null default false,
  supports_function_calling boolean not null default false,
  supports_tools boolean not null default false,
  supports_file_search boolean not null default false,
  supports_structured_outputs boolean not null default false,
  supports_streaming boolean not null default true,
  supports_reasoning boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint openai_compatible_models_ai_model_id_fkey
    foreign key (ai_model_id)
    references public.ai_models(id)
    on delete cascade
);

create index if not exists openai_compatible_models_ai_model_id_idx
  on public.openai_compatible_models(ai_model_id);

drop trigger if exists set_openai_compatible_models_updated_at on public.openai_compatible_models;
create trigger set_openai_compatible_models_updated_at
before update on public.openai_compatible_models
for each row execute procedure public.set_updated_at();

alter table public.openai_compatible_models enable row level security;

drop policy if exists "openai_compatible_models_select_enabled" on public.openai_compatible_models;
create policy "openai_compatible_models_select_enabled"
on public.openai_compatible_models
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_models
    where ai_models.id = openai_compatible_models.ai_model_id
      and ai_models.is_enabled = true
  )
);

create table public.gemini_models (
  id uuid primary key default gen_random_uuid(),
  ai_model_id uuid not null unique,
  name varchar(160) not null unique,
  supports_text boolean not null default true,
  supports_image boolean not null default false,
  supports_audio boolean not null default false,
  supports_video boolean not null default false,
  supports_google_search boolean not null default false,
  supports_url_context boolean not null default false,
  supports_code_execution boolean not null default false,
  supports_function_calling boolean not null default false,
  supports_tools boolean not null default false,
  supports_file_search boolean not null default false,
  supports_structured_outputs boolean not null default false,
  supports_streaming boolean not null default true,
  supports_reasoning boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gemini_models_ai_model_id_fkey
    foreign key (ai_model_id)
    references public.ai_models(id)
    on delete cascade
);

create index if not exists gemini_models_ai_model_id_idx
  on public.gemini_models(ai_model_id);

drop trigger if exists set_gemini_models_updated_at on public.gemini_models;
create trigger set_gemini_models_updated_at
before update on public.gemini_models
for each row execute procedure public.set_updated_at();

alter table public.gemini_models enable row level security;

drop policy if exists "gemini_models_select_enabled" on public.gemini_models;
create policy "gemini_models_select_enabled"
on public.gemini_models
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_models
    where ai_models.id = gemini_models.ai_model_id
      and ai_models.is_enabled = true
  )
);

insert into public.ai_models (
  provider,
  api_style,
  upstream_model_id,
  label,
  description,
  icon,
  is_enabled,
  is_default,
  sort_order
)
values (
  'gemini',
  'gemini_native',
  'gemini-3-flash-preview',
  'Gemini 3 Flash Preview',
  'Gemini 3 Flash Preview：支持文本、图像、音频、视频与 PDF 输入，具备 Google Search、URL Context、Code Execution、File Search、Structured Outputs、Function Calling 与 Thinking 能力。',
  'https://ekswdwnxsugmtkdxfmnd.supabase.co/storage/v1/object/public/ai_svgs/gemini.svg',
  true,
  true,
  10
);

insert into public.gemini_models (
  ai_model_id,
  name,
  supports_text,
  supports_image,
  supports_audio,
  supports_video,
  supports_google_search,
  supports_url_context,
  supports_code_execution,
  supports_function_calling,
  supports_tools,
  supports_file_search,
  supports_structured_outputs,
  supports_streaming,
  supports_reasoning
)
select
  id,
  'gemini-3-flash-preview',
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true
from public.ai_models
where provider = 'gemini'
  and upstream_model_id = 'gemini-3-flash-preview';
