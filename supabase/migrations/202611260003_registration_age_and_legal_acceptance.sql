create table if not exists public.registration_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_eligible boolean not null default true check (age_eligible = true),
  minimum_age_years smallint not null default 18 check (minimum_age_years = 18),
  terms_version text not null,
  privacy_version text not null,
  ai_data_consent boolean not null default false,
  ai_consent_version text,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.registration_acceptances enable row level security;
revoke all privileges on table public.registration_acceptances from anon, authenticated, public;
grant select on table public.registration_acceptances to authenticated;

drop policy if exists "Users can read their own registration acceptance" on public.registration_acceptances;
create policy "Users can read their own registration acceptance"
on public.registration_acceptances
for select
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.registration_acceptances is
'Stores versioned terms/privacy acceptance and the age-eligibility result. Birth date is checked at submission and is not retained. Writes are server-side only.';
