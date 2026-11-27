alter table public.financial_profiles
  add column if not exists country_code text,
  add column if not exists default_currency text;

-- Preserve existing users' current profile currency as their initial default.
update public.financial_profiles
set default_currency = coalesce(nullif(default_currency, ''), nullif(currency, ''), 'ARS')
where default_currency is null or default_currency = '';

-- Existing profiles remain valid; new onboarding requires both values in the app.
alter table public.financial_profiles
  drop constraint if exists financial_profiles_country_code_format;

alter table public.financial_profiles
  add constraint financial_profiles_country_code_format
  check (country_code is null or country_code ~ '^[A-Z]{2}$');

alter table public.financial_profiles
  drop constraint if exists financial_profiles_default_currency_format;

alter table public.financial_profiles
  add constraint financial_profiles_default_currency_format
  check (default_currency is null or default_currency ~ '^[A-Z]{3}$');
