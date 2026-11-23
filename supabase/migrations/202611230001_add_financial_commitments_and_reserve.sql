alter table public.financial_profiles
  add column if not exists protected_reserve_amount numeric(14,2),
  add column if not exists protected_reserve_currency text;

alter table public.financial_profiles
  drop constraint if exists financial_profiles_protected_reserve_nonnegative;

alter table public.financial_profiles
  add constraint financial_profiles_protected_reserve_nonnegative
  check (protected_reserve_amount is null or protected_reserve_amount >= 0);

create table if not exists public.financial_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  category text not null check (
    category in (
      'housing',
      'food',
      'education',
      'transport',
      'health',
      'services',
      'other_essential',
      'installment',
      'debt',
      'subscription',
      'other_commitment'
    )
  ),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'ARS',
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  due_date date,
  amount_type text not null default 'exact' check (amount_type in ('exact', 'approximate')),
  cost_type text not null default 'fixed' check (cost_type in ('fixed', 'variable')),
  is_shared boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_commitments_user_active_idx
  on public.financial_commitments (user_id, is_active);

alter table public.financial_commitments enable row level security;

drop policy if exists "Users can view their own financial commitments"
  on public.financial_commitments;
create policy "Users can view their own financial commitments"
  on public.financial_commitments for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own financial commitments"
  on public.financial_commitments;
create policy "Users can insert their own financial commitments"
  on public.financial_commitments for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own financial commitments"
  on public.financial_commitments;
create policy "Users can update their own financial commitments"
  on public.financial_commitments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own financial commitments"
  on public.financial_commitments;
create policy "Users can delete their own financial commitments"
  on public.financial_commitments for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.financial_commitments to authenticated;
revoke all on public.financial_commitments from anon;
