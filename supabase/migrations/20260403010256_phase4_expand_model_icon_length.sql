alter table public.gemini_models
  alter column icon type text;

alter table public.openai_compatible_models
  alter column icon type text;
