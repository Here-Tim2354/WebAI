-- Phase 4 model registry
-- Introduces two dedicated model registry tables:
-- public.openai_compatible_models
-- public.gemini_models

create table if not exists public.openai_compatible_models (
  id uuid primary key default gen_random_uuid(),
  model_id varchar(120) not null unique,
  upstream_object varchar(50),
  owned_by varchar(120),
  upstream_created_at timestamptz,
  label varchar(120) not null,
  description text,
  provider_name varchar(120) not null default 'openai',
  base_url text,
  api_style varchar(50) not null default 'openai_compatible',
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
  context_window integer,
  max_output_tokens integer,
  is_enabled boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint openai_compatible_models_api_style_check
    check (api_style = 'openai_compatible'),
  constraint openai_compatible_models_context_window_check
    check (context_window is null or context_window > 0),
  constraint openai_compatible_models_max_output_tokens_check
    check (max_output_tokens is null or max_output_tokens > 0)
);

create table if not exists public.gemini_models (
  id uuid primary key default gen_random_uuid(),
  name varchar(160) not null unique,
  base_model_id varchar(120),
  version varchar(120),
  display_name varchar(160) not null,
  description text,
  input_token_limit integer,
  output_token_limit integer,
  supported_generation_methods text[] not null default '{}',
  thinking boolean,
  temperature numeric(4, 3),
  max_temperature numeric(4, 3),
  top_p numeric(5, 4),
  top_k integer,
  api_style varchar(50) not null default 'gemini_native',
  supports_text boolean not null default true,
  supports_image boolean not null default false,
  supports_audio boolean not null default false,
  supports_video boolean not null default false,
  supports_google_search boolean not null default false,
  supports_url_context boolean not null default false,
  supports_code_execution boolean not null default false,
  supports_function_calling boolean not null default false,
  supports_tools boolean not null default false,
  supports_streaming boolean not null default true,
  supports_reasoning boolean not null default false,
  is_enabled boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gemini_models_api_style_check
    check (api_style = 'gemini_native'),
  constraint gemini_models_input_token_limit_check
    check (input_token_limit is null or input_token_limit > 0),
  constraint gemini_models_output_token_limit_check
    check (output_token_limit is null or output_token_limit > 0),
  constraint gemini_models_top_k_check
    check (top_k is null or top_k >= 0)
);

create index if not exists openai_compatible_models_enabled_idx
  on public.openai_compatible_models(is_enabled);

create index if not exists openai_compatible_models_sort_order_idx
  on public.openai_compatible_models(sort_order, label);

create unique index if not exists openai_compatible_models_default_unique_idx
  on public.openai_compatible_models(is_default)
  where is_default = true;

create index if not exists gemini_models_enabled_idx
  on public.gemini_models(is_enabled);

create index if not exists gemini_models_sort_order_idx
  on public.gemini_models(sort_order, display_name);

create unique index if not exists gemini_models_default_unique_idx
  on public.gemini_models(is_default)
  where is_default = true;

drop trigger if exists set_openai_compatible_models_updated_at on public.openai_compatible_models;
create trigger set_openai_compatible_models_updated_at
before update on public.openai_compatible_models
for each row execute procedure public.set_updated_at();

drop trigger if exists set_gemini_models_updated_at on public.gemini_models;
create trigger set_gemini_models_updated_at
before update on public.gemini_models
for each row execute procedure public.set_updated_at();

alter table public.openai_compatible_models enable row level security;
alter table public.gemini_models enable row level security;

drop policy if exists "openai_compatible_models_select_enabled" on public.openai_compatible_models;
create policy "openai_compatible_models_select_enabled"
on public.openai_compatible_models
for select
to authenticated
using (is_enabled = true);

drop policy if exists "gemini_models_select_enabled" on public.gemini_models;
create policy "gemini_models_select_enabled"
on public.gemini_models
for select
to authenticated
using (is_enabled = true);
