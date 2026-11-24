-- VERA · Vinculación atómica entre movimientos de objetivos y movimientos generales.
-- Esta migración se prepara en la rama de desarrollo. No se ejecuta automáticamente.

-- Columnas necesarias para vincular cada movimiento del objetivo con el libro general.
alter table public.financial_goal_movements
  add column if not exists movement_id uuid,
  add column if not exists verification_status text not null default 'not_required',
  add column if not exists verified_at timestamptz;

-- La cuenta asociada es opcional: NULL significa que el movimiento no modifica saldos.
alter table public.financial_goal_recurring_rules
  add column if not exists account_id uuid;

do $
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_goal_recurring_rules_account_id_fkey'
      and conrelid = 'public.financial_goal_recurring_rules'::regclass
  ) then
    alter table public.financial_goal_recurring_rules
      add constraint financial_goal_recurring_rules_account_id_fkey
      foreign key (account_id) references public.financial_accounts(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_goal_movements_verification_status_check'
      and conrelid = 'public.financial_goal_movements'::regclass
  ) then
    alter table public.financial_goal_movements
      add constraint financial_goal_movements_verification_status_check
      check (verification_status in ('not_required', 'pending', 'verified'));
  end if;
end;
$;

do $$
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
end;
$$;

create unique index if not exists financial_goal_movements_movement_id_uidx
  on public.financial_goal_movements (movement_id)
  where movement_id is not null;

create or replace function public.create_linked_goal_movement(
  p_goal_id uuid,
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_category text,
  p_description text,
  p_movement_date date,
  p_account_id uuid,
  p_source text,
  p_recurring_rule_id uuid default null,
  p_scheduled_for_date date default null,
  p_status text default 'posted',
  p_verification_status text default 'not_required'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  goal_row public.financial_goals%rowtype;
  account_row public.financial_accounts%rowtype;
  general_movement_id uuid;
  goal_movement_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized';
  end if;

  if p_type not in ('income', 'expense') or p_amount is null or p_amount <= 0
     or p_status not in ('pending', 'posted', 'cancelled') then
    raise exception 'Invalid goal movement data';
  end if;

  select * into goal_row
  from public.financial_goals
  where id = p_goal_id and user_id = p_user_id
  for update;

  if not found then raise exception 'Goal not found'; end if;

  if p_account_id is not null then
    select * into account_row
    from public.financial_accounts
    where id = p_account_id and user_id = p_user_id and is_archived = false;

    if not found then raise exception 'Account not found or unavailable'; end if;
    if account_row.currency <> goal_row.currency then
      raise exception 'Account currency must match goal currency';
    end if;
  end if;

  if p_status = 'posted' then
    insert into public.movements (
      user_id, description, type, amount, currency, category, movement_date, account_id
    ) values (
      p_user_id,
      coalesce(nullif(trim(p_description), ''), p_category),
      p_type, p_amount, goal_row.currency, p_category, p_movement_date, p_account_id
    ) returning id into general_movement_id;
  end if;

  insert into public.financial_goal_movements (
    goal_id, user_id, type, amount, category, description, movement_date,
    status, source, recurring_rule_id, scheduled_for_date,
    verification_status, movement_id
  ) values (
    p_goal_id, p_user_id, p_type, p_amount, p_category, p_description, p_movement_date,
    p_status, p_source, p_recurring_rule_id, p_scheduled_for_date,
    p_verification_status, general_movement_id
  ) returning id into goal_movement_id;

  return goal_movement_id;
end;
$$;

create or replace function public.confirm_linked_goal_movement(
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
  goal_row public.financial_goals%rowtype;
  rule_account_id uuid;
  general_movement_id uuid;
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
  if goal_movement.status <> 'pending' then
    raise exception 'Goal movement is not pending';
  end if;

  select * into goal_row from public.financial_goals
  where id = goal_movement.goal_id and user_id = p_user_id;
  if not found then raise exception 'Goal not found'; end if;

  if goal_movement.recurring_rule_id is not null then
    select account_id into rule_account_id
    from public.financial_goal_recurring_rules
    where id = goal_movement.recurring_rule_id and user_id = p_user_id;
  end if;

  if rule_account_id is not null and not exists (
    select 1 from public.financial_accounts
    where id = rule_account_id and user_id = p_user_id
      and is_archived = false and currency = goal_row.currency
  ) then
    raise exception 'Linked account is unavailable or has a different currency';
  end if;

  insert into public.movements (
    user_id, description, type, amount, currency, category, movement_date, account_id
  ) values (
    p_user_id,
    coalesce(nullif(trim(goal_movement.description), ''), goal_movement.category),
    goal_movement.type, goal_movement.amount, goal_row.currency,
    goal_movement.category, goal_movement.movement_date, rule_account_id
  ) returning id into general_movement_id;

  update public.financial_goal_movements
  set status = 'posted', movement_id = general_movement_id, updated_at = now()
  where id = p_goal_movement_id and user_id = p_user_id;

  return general_movement_id;
end;
$$;

create or replace function public.process_financial_goal_recurring_rules()
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
  created_id uuid;
  iteration_count integer;
  month_interval interval;
  desired_day integer;
  month_start date;
  month_last_day integer;
begin
  for rule_row in
    select r.*
    from public.financial_goal_recurring_rules r
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
        update public.financial_goal_recurring_rules
        set status = 'completed', updated_at = now()
        where id = rule_row.id;
        exit;
      end if;

      if not exists (
        select 1 from public.financial_goal_movements
        where recurring_rule_id = rule_row.id and scheduled_for_date = run_date
      ) then
        created_id := public.create_linked_goal_movement(
          rule_row.goal_id, rule_row.user_id, rule_row.type, rule_row.amount,
          rule_row.category, rule_row.description, run_date, rule_row.account_id,
          'recurring', rule_row.id, run_date,
          case when rule_row.mode = 'confirmation' then 'pending' else 'posted' end,
          case when rule_row.mode = 'automatic' then 'pending' else 'not_required' end
        );
        created_count := created_count + 1;
      end if;

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
          last_run_at = now(), updated_at = now()
      where id = rule_row.id;

      if rule_row.end_date is not null and next_date > rule_row.end_date then exit; end if;
      run_date := next_date;
    end loop;
  end loop;

  return created_count;
end;
$$;

revoke all on function public.create_linked_goal_movement(uuid, uuid, text, numeric, text, text, date, uuid, text, uuid, date, text, text) from public, anon, authenticated;
revoke all on function public.confirm_linked_goal_movement(uuid, uuid) from public, anon, authenticated;
revoke all on function public.process_financial_goal_recurring_rules() from public, anon, authenticated;
grant execute on function public.create_linked_goal_movement(uuid, uuid, text, numeric, text, text, date, uuid, text, uuid, date, text, text) to authenticated;
grant execute on function public.confirm_linked_goal_movement(uuid, uuid) to authenticated;
grant execute on function public.process_financial_goal_recurring_rules() to service_role;
