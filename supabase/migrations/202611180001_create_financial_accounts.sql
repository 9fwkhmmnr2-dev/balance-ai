-- FINANCE.AI · Mis cuentas
-- Los movimientos históricos permanecen intactos: account_id admite NULL.

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 50),
  type text not null check (type in ('cash', 'wallet', 'bank', 'savings', 'other')),
  currency text not null check (currency in ('ARS', 'USD', 'EUR')),
  initial_balance numeric(14,2) not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_accounts_user_id_idx
  on public.financial_accounts(user_id);

alter table public.financial_accounts enable row level security;

drop policy if exists "Users can view their own financial accounts" on public.financial_accounts;
create policy "Users can view their own financial accounts"
  on public.financial_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own financial accounts" on public.financial_accounts;
create policy "Users can create their own financial accounts"
  on public.financial_accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own financial accounts" on public.financial_accounts;
create policy "Users can update their own financial accounts"
  on public.financial_accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own financial accounts" on public.financial_accounts;
create policy "Users can delete their own financial accounts"
  on public.financial_accounts for delete
  using (auth.uid() = user_id);

alter table public.movements
  add column if not exists account_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'movements_account_id_fkey'
      and conrelid = 'public.movements'::regclass
  ) then
    alter table public.movements
      add constraint movements_account_id_fkey
      foreign key (account_id) references public.financial_accounts(id)
      on delete set null;
  end if;
end $$;

create index if not exists movements_account_id_idx
  on public.movements(account_id);


-- Evita asociar un movimiento a una cuenta de otro usuario o de otra moneda.
create or replace function public.validate_movement_account_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.account_id is not null and not exists (
    select 1
    from public.financial_accounts a
    where a.id = new.account_id
      and a.user_id = new.user_id
      and a.currency = new.currency
  ) then
    raise exception 'La cuenta seleccionada no pertenece al usuario o usa otra moneda.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists movements_validate_account_owner on public.movements;
create trigger movements_validate_account_owner
  before insert or update of account_id, user_id, currency
  on public.movements
  for each row execute function public.validate_movement_account_owner();
