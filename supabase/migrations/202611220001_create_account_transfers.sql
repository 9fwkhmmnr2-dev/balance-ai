-- FINANCE.AI · Transferencias entre cuentas propias
-- Se registran por separado: nunca cuentan como ingreso ni gasto.

create table public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  to_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD', 'EUR')),
  created_at timestamptz not null default now(),
  constraint account_transfers_distinct_accounts check (from_account_id <> to_account_id)
);

create index account_transfers_user_id_idx on public.account_transfers(user_id);
create index account_transfers_from_account_idx on public.account_transfers(from_account_id);
create index account_transfers_to_account_idx on public.account_transfers(to_account_id);

alter table public.account_transfers enable row level security;

create policy "Users can view their own account transfers"
  on public.account_transfers for select
  using (auth.uid() = user_id);

revoke all on public.account_transfers from anon, authenticated;
grant select on public.account_transfers to authenticated;

-- La operación completa ocurre en una sola transacción en PostgreSQL.
-- Bloquea las dos cuentas, valida el saldo disponible y registra la transferencia.
create or replace function public.create_account_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_from public.financial_accounts%rowtype;
  v_to public.financial_accounts%rowtype;
  v_balance numeric(14,2);
  v_transfer_id uuid;
begin
  if v_user_id is null then
    raise exception 'Iniciá sesión para registrar una transferencia.';
  end if;

  if p_from_account_id is null or p_to_account_id is null
     or p_from_account_id = p_to_account_id then
    raise exception 'Elegí dos cuentas diferentes.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Ingresá un importe válido.';
  end if;

  -- Bloqueo consistente para evitar transferencias simultáneas que gasten el mismo saldo.
  perform 1
  from public.financial_accounts
  where id in (p_from_account_id, p_to_account_id)
    and user_id = v_user_id
  order by id
  for update;

  select * into v_from
  from public.financial_accounts
  where id = p_from_account_id and user_id = v_user_id;

  if not found then
    raise exception 'La cuenta de origen no está disponible.';
  end if;

  select * into v_to
  from public.financial_accounts
  where id = p_to_account_id and user_id = v_user_id;

  if not found then
    raise exception 'La cuenta de destino no está disponible.';
  end if;

  if v_from.is_archived or v_to.is_archived then
    raise exception 'Solo podés transferir entre cuentas activas.';
  end if;

  if v_from.currency <> v_to.currency then
    raise exception 'Las dos cuentas deben usar la misma moneda.';
  end if;

  if round(p_amount, 2) <> p_amount then
    raise exception 'El importe admite hasta dos decimales.';
  end if;

  select
    v_from.initial_balance
    + coalesce((
      select sum(case when m.type = 'income' then m.amount else -m.amount end)
      from public.movements m
      where m.account_id = v_from.id and m.user_id = v_user_id
    ), 0)
    + coalesce((
      select sum(t.amount)
      from public.account_transfers t
      where t.to_account_id = v_from.id and t.user_id = v_user_id
    ), 0)
    - coalesce((
      select sum(t.amount)
      from public.account_transfers t
      where t.from_account_id = v_from.id and t.user_id = v_user_id
    ), 0)
  into v_balance;

  if v_balance < p_amount then
    raise exception 'La cuenta de origen no tiene saldo suficiente.';
  end if;

  insert into public.account_transfers (
    user_id, from_account_id, to_account_id, amount, currency
  ) values (
    v_user_id, v_from.id, v_to.id, p_amount, v_from.currency
  )
  returning id into v_transfer_id;

  return v_transfer_id;
end;
$$;

revoke all on function public.create_account_transfer(uuid, uuid, numeric) from public, anon;
grant execute on function public.create_account_transfer(uuid, uuid, numeric) to authenticated;
