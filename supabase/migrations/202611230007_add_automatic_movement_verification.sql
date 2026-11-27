-- FINANCETRACK · Verificación de movimientos recurrentes automáticos
-- Agrega trazabilidad de comprobación sin alterar el impacto del movimiento en el progreso.

alter table public.financial_goal_movements
  add column if not exists verification_status text not null default 'not_required',
  add column if not exists verified_at timestamptz;

alter table public.financial_goal_movements
  drop constraint if exists financial_goal_movements_verification_status_check;

alter table public.financial_goal_movements
  add constraint financial_goal_movements_verification_status_check
  check (verification_status in ('not_required', 'pending', 'verified'));

-- Los movimientos automáticos ya registrados quedan pendientes de revisión.
update public.financial_goal_movements m
set verification_status = 'pending'
from public.financial_goal_recurring_rules r
where m.recurring_rule_id = r.id
  and m.source = 'recurring'
  and m.status = 'posted'
  and r.mode = 'automatic'
  and m.verification_status = 'not_required';

create index if not exists financial_goal_movements_user_verification_idx
  on public.financial_goal_movements (user_id, verification_status, movement_date desc)
  where source = 'recurring' and status = 'posted';
