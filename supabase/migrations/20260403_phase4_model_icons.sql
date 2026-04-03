alter table public.gemini_models
  add column if not exists icon varchar(80);

alter table public.openai_compatible_models
  add column if not exists icon varchar(80);

update public.gemini_models
set icon = coalesce(icon, 'gemini')
where name = 'gemini-3-flash-preview';
