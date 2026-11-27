-- VERA · Plan comercial de cada usuario.
-- La ausencia de una fila equivale a FREE.
-- Los usuarios solo pueden leer su propio plan; las asignaciones se realizan
-- desde un entorno administrativo confiable (service_role / SQL Editor).

create table if not exists public.user_plan_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'premium')),
  status text not null default 'active'
    check (status in ('active', 'cancelled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_plan_subscriptions_free_no_expiry_check
    check (plan <> 'free' or expires_at is null)
);

create index if not exists user_plan_subscriptions_plan_status_idx
  on public.user_plan_subscriptions(plan, status);

alter table public.user_plan_subscriptions enable row level security;

revoke all on public.user_plan_subscriptions from anon;
revoke all on public.user_plan_subscriptions from authenticated;
grant select on public.user_plan_subscriptions to authenticated;

drop policy if exists "Users can view their own plan" on public.user_plan_subscriptions;
create policy "Users can view their own plan"
  on public.user_plan_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No se conceden INSERT, UPDATE ni DELETE a usuarios autenticados.
-- La aplicación debe consultar esta tabla desde el servidor para autorizar
-- funciones Premium; ocultar controles en la interfaz nunca es suficiente.
