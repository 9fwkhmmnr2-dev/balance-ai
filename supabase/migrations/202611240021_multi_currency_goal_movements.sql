-- VERA · Soporte de monedas mixtas en objetivos.
-- Preparada para Preview. NO ejecutar en Supabase hasta revisar y aprobar la aplicación.
-- Los importes originales se conservan; cada movimiento y regla registra su propia moneda.
-- Las funciones usan movement_date, que es el campo real de la tabla desplegada.
-- No ejecutar las migraciones antiguas 202611230006/007/008 sin adaptar: usan movement_date.

alter table public.financial_goals
  drop constraint if exists financial_goals_currency_check;
alter table public.financial_goals
  drop constraint if exists financial_goals_currency_format;
alter table public.financial_goals
  add constraint financial_goals_currency_format
  check (currency ~ '^[A-Z]{3}$');

alter table public.financial_goal_movements
  add column if not exists currency text,
  add column if not exists goal_amount numeric(20,8),
  add column if not exists exchange_rate numeric(24,12),
  add column if not exists rate_source text,
  add column if not exists rate_at timestamptz,
  add column if not exists movement_id uuid,
  add column if not exists scheduled_for_date date,
  add column if not exists verification_status text not null default 'not_required',
  add column if not exists verified_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.financial_goal_movements
  drop constraint if exists financial_goal_movements_verification_status_check;
alter table public.financial_goal_movements
  add constraint financial_goal_movements_verification_status_check
  check (verification_status in ('not_required', 'pending', 'verified'));

alter table public.financial_goal_recurring_rules
  add column if not exists currency text,
  add column if not exists account_id uuid;

update public.financial_goal_movements m
set currency = coalesce(nullif(m.currency, ''), g.currency),
    goal_amount = coalesce(m.goal_amount, m.amount),
    exchange_rate = coalesce(m.exchange_rate, 1),
    rate_source = coalesce(m.rate_source, 'historical_legacy'),
    rate_at = coalesce(m.rate_at, m.created_at, now())
from public.financial_goals g
where g.id = m.goal_id
  and (m.currency is null or m.currency = ''
       or m.goal_amount is null or m.exchange_rate is null
       or m.rate_source is null or m.rate_at is null);

update public.financial_goal_recurring_rules r
set currency = g.currency
from public.financial_goals g
where g.id = r.goal_id
  and (r.currency is null or r.currency = '');

alter table public.financial_goal_movements
  alter column currency set not null;
alter table public.financial_goal_movements
  alter column goal_amount set not null,
  alter column exchange_rate set not null,
  alter column rate_source set not null,
  alter column rate_at set not null;
alter table public.financial_goal_movements
  drop constraint if exists financial_goal_movements_goal_amount_check;
alter table public.financial_goal_movements
  add constraint financial_goal_movements_goal_amount_check check (goal_amount >= 0);
alter table public.financial_goal_movements
  drop constraint if exists financial_goal_movements_exchange_rate_check;
alter table public.financial_goal_movements
  add constraint financial_goal_movements_exchange_rate_check check (exchange_rate > 0);
alter table public.financial_goal_recurring_rules
  alter column currency set not null;

alter table public.financial_goal_movements
  drop constraint if exists financial_goal_movements_currency_format;
alter table public.financial_goal_movements
  add constraint financial_goal_movements_currency_format
  check (currency ~ '^[A-Z]{3}$');

alter table public.financial_goal_recurring_rules
  drop constraint if exists financial_goal_recurring_rules_currency_format;
alter table public.financial_goal_recurring_rules
  add constraint financial_goal_recurring_rules_currency_format
  check (currency ~ '^[A-Z]{3}$');

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_goal_movements_movement_id_fkey'
      and conrelid = 'public.financial_goal_movements'::regclass
  ) then
    alter table public.financial_goal_movements
      add constraint financial_goal_movements_movement_id_fkey
      foreign key (movement_id) references public.movements(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_goal_recurring_rules_account_id_fkey'
      and conrelid = 'public.financial_goal_recurring_rules'::regclass
  ) then
    alter table public.financial_goal_recurring_rules
      add constraint financial_goal_recurring_rules_account_id_fkey
      foreign key (account_id) references public.financial_accounts(id) on delete set null;
  end if;
end;
$constraints$;

create unique index if not exists financial_goal_movements_movement_id_uidx
  on public.financial_goal_movements (movement_id)
  where movement_id is not null;

create unique index if not exists financial_goal_movements_recurring_date_uidx
  on public.financial_goal_movements (recurring_rule_id, scheduled_for_date)
  where recurring_rule_id is not null and scheduled_for_date is not null;

create or replace function public.create_goal_movement_multi_currency(
  p_goal_id uuid,
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_currency text,
  p_category text,
  p_description text,
  p_occurred_at date,
  p_account_id uuid,
  p_source text,
  p_recurring_rule_id uuid,
  p_scheduled_for_date date,
  p_status text,
  p_verification_status text,
  p_goal_amount numeric default null,
  p_exchange_rate numeric default 1,
  p_rate_source text default 'same_currency',
  p_rate_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  goal_row public.financial_goals%rowtype;
  account_row public.financial_accounts%rowtype;
  movement_row_id uuid;
  goal_movement_id uuid;
  existing_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  if p_type is null or p_type not in ('income', 'expense')
     or p_amount is null or p_amount <= 0
     or p_currency is null or p_currency !~ '^[A-Z]{3}$'
     or p_status is null or p_status not in ('pending', 'posted', 'cancelled')
     or p_source is null or p_source not in ('manual', 'recurring')
     or p_verification_status is null
     or p_verification_status not in ('not_required', 'pending', 'verified')
     or p_occurred_at is null
     or p_exchange_rate is null or p_exchange_rate <= 0
     or p_rate_source is null or length(trim(p_rate_source)) = 0
     or p_rate_at is null
     or (p_currency = (select currency from public.financial_goals where id = p_goal_id and user_id = p_user_id)
         and p_goal_amount is not null and abs(p_goal_amount - p_amount) > 0.00000001)
     or (p_currency <> (select currency from public.financial_goals where id = p_goal_id and user_id = p_user_id)
         and (p_goal_amount is null or p_goal_amount <= 0)) then
    raise exception 'Invalid goal movement data';
  end if;

  select * into goal_row
  from public.financial_goals
  where id = p_goal_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Goal not found'; end if;

  if p_source = 'manual' and p_recurring_rule_id is not null then
    raise exception 'Manual movements cannot reference a recurring rule';
  end if;

  if p_source = 'recurring' then
    if p_recurring_rule_id is null or p_scheduled_for_date is null then
      raise exception 'Recurring movement requires a rule and scheduled date';
    end if;
    perform 1 from public.financial_goal_recurring_rules
    where id = p_recurring_rule_id and goal_id = p_goal_id
      and user_id = p_user_id and currency = p_currency
    for update;
    if not found then raise exception 'Recurring rule does not belong to this goal or currency'; end if;

    select id into existing_id
    from public.financial_goal_movements
    where recurring_rule_id = p_recurring_rule_id
      and scheduled_for_date = p_scheduled_for_date
    limit 1;
    if existing_id is not null then return existing_id; end if;
  end if;

  if p_account_id is not null then
    select * into account_row
    from public.financial_accounts
    where id = p_account_id and user_id = p_user_id and is_archived = false;
    if not found then raise exception 'Account not found or unavailable'; end if;
    if account_row.currency <> p_currency then
      raise exception 'Account currency must match movement currency';
    end if;
  end if;

  if p_status = 'posted' then
    insert into public.movements (
      user_id, description, type, amount, currency, category, movement_date, account_id
    ) values (
      p_user_id, coalesce(nullif(trim(p_description), ''), p_category),
      p_type, p_amount, p_currency, p_category, p_occurred_at, p_account_id
    ) returning id into movement_row_id;
  end if;

  insert into public.financial_goal_movements (
    goal_id, user_id, type, amount, currency, goal_amount, exchange_rate, rate_source, rate_at,
    category, description, movement_date, status, source, recurring_rule_id, scheduled_for_date,
    verification_status, movement_id, created_at, updated_at
  ) values (
    p_goal_id, p_user_id, p_type, p_amount, p_currency,
    coalesce(p_goal_amount, p_amount), p_exchange_rate, p_rate_source, p_rate_at,
    p_category, p_description, p_occurred_at, p_status, p_source, p_recurring_rule_id,
    p_scheduled_for_date, p_verification_status, movement_row_id, now(), now()
  ) returning id into goal_movement_id;

  return goal_movement_id;
end;
$$;

create or replace function public.confirm_goal_movement_multi_currency(
  p_goal_movement_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  goal_movement public.financial_goal_movements%rowtype;
  rule_account_id uuid;
  ledger_movement_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  select * into goal_movement
  from public.financial_goal_movements
  where id = p_goal_movement_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Goal movement not found'; end if;
  if goal_movement.status = 'posted' and goal_movement.movement_id is not null then
    return goal_movement.movement_id;
  end if;
  if goal_movement.status <> 'pending' then raise exception 'Goal movement is not pending'; end if;

  if goal_movement.recurring_rule_id is not null then
    select account_id into rule_account_id
    from public.financial_goal_recurring_rules
    where id = goal_movement.recurring_rule_id and user_id = p_user_id;
  end if;

  if rule_account_id is not null and not exists (
    select 1 from public.financial_accounts
    where id = rule_account_id and user_id = p_user_id
      and is_archived = false and currency = goal_movement.currency
  ) then
    raise exception 'Linked account is unavailable or has a different currency';
  end if;

  insert into public.movements (
    user_id, description, type, amount, currency, category, movement_date, account_id
  ) values (
    p_user_id, coalesce(nullif(trim(goal_movement.description), ''), goal_movement.category),
    goal_movement.type, goal_movement.amount, goal_movement.currency,
    goal_movement.category, goal_movement.movement_date, rule_account_id
  ) returning id into ledger_movement_id;

  update public.financial_goal_movements
  set status = 'posted', movement_id = ledger_movement_id, updated_at = now()
  where id = p_goal_movement_id and user_id = p_user_id;

  return ledger_movement_id;
end;
$$;

create or replace function public.correct_goal_movement_multi_currency(
  p_goal_movement_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_category text,
  p_description text,
  p_occurred_at date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  goal_movement public.financial_goal_movements%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;
  if p_amount is null or p_amount <= 0 or nullif(trim(p_category), '') is null or p_occurred_at is null then
    raise exception 'Invalid correction data';
  end if;

  select * into goal_movement
  from public.financial_goal_movements
  where id = p_goal_movement_id and user_id = p_user_id
    and source = 'recurring' and status = 'posted'
    and verification_status = 'pending'
  for update;
  if not found then raise exception 'Automatic movement is not pending verification'; end if;

  if goal_movement.movement_id is not null then
    update public.movements
    set amount = p_amount, category = trim(p_category),
        description = coalesce(nullif(trim(p_description), ''), trim(p_category)),
        movement_date = p_occurred_at
    where id = goal_movement.movement_id and user_id = p_user_id;
    if not found then raise exception 'Ledger movement not found'; end if;
  end if;

  update public.financial_goal_movements
  set amount = p_amount, goal_amount = p_amount * goal_movement.exchange_rate,
      category = trim(p_category),
      description = nullif(trim(p_description), ''),
      movement_date = p_occurred_at,
      verification_status = 'pending', verified_at = null, updated_at = now()
  where id = p_goal_movement_id and user_id = p_user_id;
  return p_goal_movement_id;
end;
$$;

create or replace function public.delete_goal_movement_multi_currency(
  p_goal_movement_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  goal_movement public.financial_goal_movements%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;
  select * into goal_movement
  from public.financial_goal_movements
  where id = p_goal_movement_id and user_id = p_user_id and source = 'manual'
  for update;
  if not found then return false; end if;

  if goal_movement.movement_id is not null then
    delete from public.movements
    where id = goal_movement.movement_id and user_id = p_user_id;
  end if;
  delete from public.financial_goal_movements
  where id = p_goal_movement_id and user_id = p_user_id;
  return true;
end;
$$;

create or replace function public.process_financial_goal_recurring_rules_multi_currency()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rule_row public.financial_goal_recurring_rules%rowtype;
  run_date date;
  next_date date;
  today_argentina date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  created_count integer := 0;
  iteration_count integer := 0;
  month_interval interval;
  desired_day integer;
  month_start date;
  month_last_day integer;
begin
  for rule_row in
    select r.* from public.financial_goal_recurring_rules r
    join public.financial_goals g on g.id = r.goal_id and g.user_id = r.user_id
    where r.status = 'active' and g.status = 'active'
      and r.next_run_date <= today_argentina
    order by r.next_run_date, r.id
    for update of r skip locked
  loop
    run_date := rule_row.next_run_date;
    iteration_count := 0;
    while run_date <= today_argentina and iteration_count < 500 loop
      iteration_count := iteration_count + 1;
      if rule_row.end_date is not null and run_date > rule_row.end_date then
        update public.financial_goal_recurring_rules set status = 'completed', updated_at = now()
        where id = rule_row.id;
        exit;
      end if;

      perform public.create_goal_movement_multi_currency(
        rule_row.goal_id, rule_row.user_id, rule_row.type, rule_row.amount,
        rule_row.currency, rule_row.category, rule_row.description, run_date,
        rule_row.account_id, 'recurring', rule_row.id, run_date,
        case when rule_row.mode = 'confirmation' then 'pending' else 'posted' end,
        case when rule_row.mode = 'automatic' then 'pending' else 'not_required' end
      );
      created_count := created_count + 1;

      if rule_row.frequency = 'daily' then
        next_date := run_date + 1;
      elsif rule_row.frequency = 'weekly' then
        next_date := run_date + 7;
      elsif rule_row.frequency = 'every_15_days' then
        next_date := run_date + 15;
      elsif rule_row.frequency in ('monthly', 'every_2_months', 'every_3_months', 'every_6_months') then
        month_interval := case rule_row.frequency
          when 'monthly' then interval '1 month'
          when 'every_2_months' then interval '2 months'
          when 'every_3_months' then interval '3 months'
          else interval '6 months'
        end;
        month_start := date_trunc('month', run_date + month_interval)::date;
        month_last_day := extract(day from (month_start + interval '1 month - 1 day'))::integer;
        desired_day := coalesce(rule_row.schedule_day, extract(day from rule_row.start_date)::integer);
        next_date := month_start + (least(desired_day, month_last_day) - 1);
      elsif rule_row.frequency = 'yearly' then
        next_date := (run_date + interval '1 year')::date;
      elsif rule_row.frequency = 'custom' and rule_row.interval_days between 1 and 365 then
        next_date := run_date + rule_row.interval_days;
      else
        raise exception 'Unsupported recurring frequency for rule %', rule_row.id;
      end if;

      update public.financial_goal_recurring_rules
      set next_run_date = next_date,
          status = case when end_date is not null and next_date > end_date then 'completed' else status end,
          updated_at = now()
      where id = rule_row.id;

      if rule_row.end_date is not null and next_date > rule_row.end_date then exit; end if;
      run_date := next_date;
    end loop;
  end loop;
  return created_count;
end;
$$;

revoke all on function public.create_goal_movement_multi_currency(uuid, uuid, text, numeric, text, text, text, date, uuid, text, uuid, date, text, text, numeric, numeric, text, timestamptz) from public, anon;
revoke all on function public.confirm_goal_movement_multi_currency(uuid, uuid) from public, anon;
revoke all on function public.correct_goal_movement_multi_currency(uuid, uuid, numeric, text, text, date) from public, anon;
revoke all on function public.delete_goal_movement_multi_currency(uuid, uuid) from public, anon;
revoke all on function public.process_financial_goal_recurring_rules_multi_currency() from public, anon, authenticated;
grant execute on function public.create_goal_movement_multi_currency(uuid, uuid, text, numeric, text, text, text, date, uuid, text, uuid, date, text, text, numeric, numeric, text, timestamptz) to authenticated, service_role;
grant execute on function public.confirm_goal_movement_multi_currency(uuid, uuid) to authenticated;
grant execute on function public.correct_goal_movement_multi_currency(uuid, uuid, numeric, text, text, date) to authenticated;
grant execute on function public.delete_goal_movement_multi_currency(uuid, uuid) to authenticated;
grant execute on function public.process_financial_goal_recurring_rules_multi_currency() to service_role;