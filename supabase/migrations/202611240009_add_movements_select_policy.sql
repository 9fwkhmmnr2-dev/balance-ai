-- VERA · Permite consultar el historial general de movimientos propios.
-- No modifica datos existentes; solo habilita lectura bajo RLS.

grant select on public.movements to authenticated;

drop policy if exists "Users can view their own movements" on public.movements;

create policy "Users can view their own movements"
  on public.movements
  for select
  to authenticated
  using (auth.uid() = user_id);
