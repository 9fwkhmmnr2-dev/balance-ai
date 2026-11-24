-- VERA: asignación manual de Premium para pruebas.
-- Ejecutar únicamente desde Supabase SQL Editor por una persona autorizada.
-- Requiere que la migración user_plan_subscriptions ya esté aplicada.
-- Primero obtené el UUID del usuario desde Authentication > Users.
-- No uses email ni permitas que un usuario final ejecute este SQL.

begin;

-- Reemplazá el UUID por el id real del usuario.
-- Para 30 días: now() + interval '30 days'
-- Para 7/90 días: cambiá el intervalo.
-- Para Premium sin vencimiento durante una prueba controlada: NULL.

insert into public.user_plan_subscriptions (
  user_id,
  plan,
  status,
  expires_at,
  updated_at
)
select
  id,
  'premium',
  'active',
  now() + interval '30 days',
  now()
from auth.users
where id = 'REEMPLAZAR-POR-UUID-DEL-USUARIO'::uuid
on conflict (user_id) do update
set
  plan = excluded.plan,
  status = 'active',
  expires_at = excluded.expires_at,
  updated_at = now();

-- Verificá que se haya actualizado exactamente el usuario esperado.
select user_id, plan, status, expires_at
from public.user_plan_subscriptions
where user_id = 'REEMPLAZAR-POR-UUID-DEL-USUARIO'::uuid;

commit;

-- Para quitar Premium manualmente antes del vencimiento:
-- update public.user_plan_subscriptions
-- set plan = 'free', status = 'active', expires_at = null, updated_at = now()
-- where user_id = 'REEMPLAZAR-POR-UUID-DEL-USUARIO'::uuid;
