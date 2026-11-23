-- FINANCETRACK · Ejecución idempotente de reglas recurrentes de objetivos
-- Ejecutar una sola vez en el proyecto Supabase que utiliza la Preview.
create unique index if not exists financial_goal_movements_recurring_date_uidx
  on public.financial_goal_movements (recurring_rule_id, scheduled_for_date)
  where recurring_rule_id is not null and scheduled_for_date is not null;

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
  affected_count integer;
  iteration_count integer;
  month_interval interval;
  desired_day integer;
  month_start date;
  month_last_day integer;
begin
  for rule_row in
    select *
    from public.financial_goal_recurring_rules
    where status = 'active'
      and next_run_date <= today_argentina
    order by next_run_date, id
    for update skip locked
  loop
    run_date := rule_row.next_run_date;
    iteration_count := 0;

    while run_date <= today_argentina and iteration_count < 500 loop
      iteration_count := iteration_count + 1;

      if rule_row.end_date is not null and run_date > rule_row.end_date then
        update public.financial_goal_recurring_rules
          set status = 'completed'
          where id = rule_row.id;
        exit;
      end if;

      insert into public.financial_goal_movements (
        goal_id, user_id, type, amount, category, description,
        movement_date, status, source, recurring_rule_id, scheduled_for_date
      ) values (
        rule_row.goal_id, rule_row.user_id, rule_row.type, rule_row.amount,
        rule_row.category, rule_row.description, run_date,
        case when rule_row.mode = 'confirmation' then 'pending' else 'posted' end,
        'recurring', rule_row.id, run_date
      )
      on conflict (recurring_rule_id, scheduled_for_date)
        where recurring_rule_id is not null and scheduled_for_date is not null
      do nothing;

      get diagnostics affected_count = row_count;
      created_count := created_count + affected_count;

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

      if rule_row.end_date is not null and next_date > rule_row.end_date then
        update public.financial_goal_recurring_rules
          set next_run_date = next_date, status = 'completed'
          where id = rule_row.id;
        exit;
      end if;

      update public.financial_goal_recurring_rules
        set next_run_date = next_date
        where id = rule_row.id;

      run_date := next_date;
    end loop;
  end loop;

  return created_count;
end;
$$;

revoke all on function public.process_financial_goal_recurring_rules() from public, anon, authenticated;
grant execute on function public.process_financial_goal_recurring_rules() to service_role;
