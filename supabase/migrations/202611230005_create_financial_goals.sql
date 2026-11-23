-- FINANCETRACK · Objetivos de ahorro con progreso manual
-- El progreso solo cambia mediante aportes registrados explícitamente.
create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  target_amount numeric(14,2) not null check (target_amount > 0),
  currency text not null check (currency in ('ARS', 'USD', 'EUR')),
  target_date date,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index financial_goals_user_status_idx
  on public.financial_goals(user_id, status, created_at desc);

create table public.financial_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.financial_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  note text check (note is null or char_length(note) <= 240),
  contributed_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index financial_goal_contributions_goal_date_idx
  on public.financial_goal_contributions(goal_id, contributed_at desc);

alter table public.financial_goals enable row level security;
alter table public.financial_goal_contributions enable row level security;

create policy "Users manage their own financial goals"
  on public.financial_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users view their own goal contributions"
  on public.financial_goal_contributions for select
  using (auth.uid() = user_id);

create policy "Users add their own goal contributions"
  on public.financial_goal_contributions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.financial_goals g
      where g.id = goal_id and g.user_id = auth.uid()
    )
  );

create policy "Users delete their own goal contributions"
  on public.financial_goal_contributions for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.financial_goals to authenticated;
grant select, insert, delete on public.financial_goal_contributions to authenticated;
revoke all on public.financial_goals from anon;
revoke all on public.financial_goal_contributions from anon;
