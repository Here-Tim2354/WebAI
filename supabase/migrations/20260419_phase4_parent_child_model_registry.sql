-- Phase 4 model registry parent-child refactor
-- Introduces public.ai_models as the shared parent table for provider-specific model tables.
-- Existing provider tables remain in place and are linked through ai_model_id for a non-destructive transition.

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

insert into public.ai_models (
  provider,
  api_style,
  upstream_model_id,
  label,
  description,
  icon,
  is_enabled,
  is_default,
  sort_order,
  created_at,
  updated_at
)
select
  'openai_compatible',
  api_style,
  model_id,
  label,
  description,
  icon,
  is_enabled,
  is_default,
  sort_order,
  created_at,
  updated_at
from public.openai_compatible_models
on conflict (provider, upstream_model_id) do update
set
  api_style = excluded.api_style,
  label = excluded.label,
  description = excluded.description,
  icon = excluded.icon,
  is_enabled = excluded.is_enabled,
  is_default = excluded.is_default,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;

insert into public.ai_models (
  provider,
  api_style,
  upstream_model_id,
  label,
  description,
  icon,
  is_enabled,
  is_default,
  sort_order,
  created_at,
  updated_at
)
select
  'gemini',
  api_style,
  name,
  display_name,
  description,
  icon,
  is_enabled,
  is_default,
  sort_order,
  created_at,
  updated_at
from public.gemini_models
on conflict (provider, upstream_model_id) do update
set
  api_style = excluded.api_style,
  label = excluded.label,
  description = excluded.description,
  icon = excluded.icon,
  is_enabled = excluded.is_enabled,
  is_default = excluded.is_default,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;

alter table public.openai_compatible_models
  add column if not exists ai_model_id uuid;

alter table public.gemini_models
  add column if not exists ai_model_id uuid;

update public.openai_compatible_models as child
set ai_model_id = parent.id
from public.ai_models as parent
where parent.provider = 'openai_compatible'
  and parent.upstream_model_id = child.model_id
  and child.ai_model_id is distinct from parent.id;

update public.gemini_models as child
set ai_model_id = parent.id
from public.ai_models as parent
where parent.provider = 'gemini'
  and parent.upstream_model_id = child.name
  and child.ai_model_id is distinct from parent.id;

create unique index if not exists openai_compatible_models_ai_model_id_unique_idx
  on public.openai_compatible_models(ai_model_id)
  where ai_model_id is not null;

create unique index if not exists gemini_models_ai_model_id_unique_idx
  on public.gemini_models(ai_model_id)
  where ai_model_id is not null;

create index if not exists openai_compatible_models_ai_model_id_idx
  on public.openai_compatible_models(ai_model_id);

create index if not exists gemini_models_ai_model_id_idx
  on public.gemini_models(ai_model_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'openai_compatible_models_ai_model_id_fkey'
  ) then
    alter table public.openai_compatible_models
      add constraint openai_compatible_models_ai_model_id_fkey
      foreign key (ai_model_id)
      references public.ai_models(id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gemini_models_ai_model_id_fkey'
  ) then
    alter table public.gemini_models
      add constraint gemini_models_ai_model_id_fkey
      foreign key (ai_model_id)
      references public.ai_models(id)
      on delete cascade;
  end if;
end $$;

alter table public.ai_models enable row level security;

drop policy if exists "ai_models_select_enabled" on public.ai_models;
create policy "ai_models_select_enabled"
on public.ai_models
for select
to authenticated
using (is_enabled = true);
