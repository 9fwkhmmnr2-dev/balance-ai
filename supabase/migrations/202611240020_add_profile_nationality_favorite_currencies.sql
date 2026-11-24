alter table public.financial_profiles
  add column if not exists nationality_code text,
  add column if not exists favorite_currencies text[] not null default array['ARS']::text[];

alter table public.financial_profiles
  drop constraint if exists financial_profiles_nationality_code_format;

alter table public.financial_profiles
  add constraint financial_profiles_nationality_code_format
  check (nationality_code is null or nationality_code ~ '^[A-Z]{2}$');

alter table public.financial_profiles
  drop constraint if exists financial_profiles_favorite_currencies_format;

alter table public.financial_profiles
  add constraint financial_profiles_favorite_currencies_format
  check (
    cardinality(favorite_currencies) between 1 and 20
    and array_to_string(favorite_currencies, ',') ~ '^[A-Z]{3}(,[A-Z]{3})*$'
  );
