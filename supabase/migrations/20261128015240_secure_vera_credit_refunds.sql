create or replace function public.refund_vera_message_credit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_plus boolean := false;
  v_cap integer;
  v_remaining integer;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'VERA_REFUND_FORBIDDEN' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'VERA_USER_REQUIRED' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.user_plan_subscriptions s
    where s.user_id = p_user_id
      and s.plan = 'premium'
      and (s.status = 'active' or (s.status = 'cancelled' and s.expires_at > now()))
      and (s.expires_at is null or s.expires_at > now())
  ) into v_is_plus;

  v_cap := case when v_is_plus then 200 else 40 end;

  update private.vera_message_credits
  set remaining_credits = least(v_cap, remaining_credits + 1),
      updated_at = now()
  where user_id = p_user_id
  returning remaining_credits into v_remaining;

  return jsonb_build_object('remaining', v_remaining);
end;
$$;

revoke all on function public.refund_vera_message_credit(uuid) from public, anon, authenticated;
grant execute on function public.refund_vera_message_credit(uuid) to service_role;
