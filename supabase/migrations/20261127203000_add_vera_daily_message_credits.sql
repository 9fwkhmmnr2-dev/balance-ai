create schema if not exists private;

create table if not exists private.vera_message_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  remaining_credits integer not null check (remaining_credits >= 0),
  last_refill_date date not null,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  updated_at timestamptz not null default now()
);

alter table private.vera_message_credits enable row level security;
revoke all on table private.vera_message_credits from anon, authenticated, public;

create or replace function public.get_vera_message_credits()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_plus boolean := false;
  v_timezone text;
  v_today date;
  v_daily integer;
  v_cap integer;
  v_row private.vera_message_credits%rowtype;
  v_elapsed integer;
  v_remaining integer;
  v_reset_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'VERA_AUTH_REQUIRED' using errcode = '28000';
  end if;

  select exists (
    select 1
    from public.user_plan_subscriptions s
    where s.user_id = v_user_id
      and s.plan = 'premium'
      and (s.status = 'active' or (s.status = 'cancelled' and s.expires_at > now()))
      and (s.expires_at is null or s.expires_at > now())
  ) into v_is_plus;

  v_daily := case when v_is_plus then 100 else 20 end;
  v_cap := case when v_is_plus then 200 else 40 end;

  select nullif(u.raw_user_meta_data ->> 'timezone', '')
    into v_timezone
  from auth.users u
  where u.id = v_user_id;

  if v_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names z where z.name = v_timezone
  ) then
    v_timezone := 'America/Argentina/Buenos_Aires';
  end if;

  v_today := (now() at time zone v_timezone)::date;

  insert into private.vera_message_credits (
    user_id, remaining_credits, last_refill_date, timezone
  )
  values (v_user_id, v_daily, v_today, v_timezone)
  on conflict (user_id) do nothing;

  select * into v_row
  from private.vera_message_credits c
  where c.user_id = v_user_id
  for update;

  v_elapsed := greatest(0, v_today - v_row.last_refill_date);
  v_remaining := least(v_cap, v_row.remaining_credits + (v_elapsed * v_daily));

  update private.vera_message_credits
  set remaining_credits = v_remaining,
      last_refill_date = greatest(last_refill_date, v_today),
      timezone = v_timezone,
      updated_at = now()
  where user_id = v_user_id;

  v_reset_at := ((v_today + 1)::timestamp without time zone) at time zone v_timezone;

  return jsonb_build_object(
    'plan', case when v_is_plus then 'plus' else 'free' end,
    'remaining', v_remaining,
    'dailyAllowance', v_daily,
    'maxCredits', v_cap,
    'resetAt', v_reset_at
  );
end;
$$;

create or replace function public.claim_vera_message_credit()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state jsonb;
  v_user_id uuid := auth.uid();
  v_remaining integer;
begin
  v_state := public.get_vera_message_credits();
  v_remaining := (v_state ->> 'remaining')::integer;

  if v_remaining <= 0 then
    return v_state || jsonb_build_object('allowed', false);
  end if;

  update private.vera_message_credits
  set remaining_credits = remaining_credits - 1,
      updated_at = now()
  where user_id = v_user_id
  returning remaining_credits into v_remaining;

  return v_state || jsonb_build_object('allowed', true, 'remaining', v_remaining);
end;
$$;

create or replace function public.refund_vera_message_credit()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state jsonb;
  v_user_id uuid := auth.uid();
  v_cap integer;
  v_remaining integer;
begin
  v_state := public.get_vera_message_credits();
  v_cap := (v_state ->> 'maxCredits')::integer;

  update private.vera_message_credits
  set remaining_credits = least(v_cap, remaining_credits + 1),
      updated_at = now()
  where user_id = v_user_id
  returning remaining_credits into v_remaining;

  return v_state || jsonb_build_object('remaining', v_remaining);
end;
$$;

revoke all on function public.get_vera_message_credits() from public, anon;
revoke all on function public.claim_vera_message_credit() from public, anon;
revoke all on function public.refund_vera_message_credit() from public, anon;
grant execute on function public.get_vera_message_credits() to authenticated;
grant execute on function public.claim_vera_message_credit() to authenticated;
grant execute on function public.refund_vera_message_credit() to authenticated;
