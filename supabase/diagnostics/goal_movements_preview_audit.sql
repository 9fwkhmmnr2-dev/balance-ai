-- VERA · Auditoría de esquema para Supabase Preview.
-- SOLO LECTURA: no crea, modifica ni elimina datos, tablas, funciones o políticas.
-- Ejecutar en SQL Editor de Supabase Preview y compartir el resultado JSON.

select jsonb_build_object(
  'columns', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table', table_name,
      'column', column_name,
      'type', data_type,
      'nullable', is_nullable,
      'default', column_default
    ) order by table_name, ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'financial_goals',
        'financial_goal_movements',
        'financial_goal_recurring_rules',
        'financial_accounts',
        'movements'
      )
  ), '[]'::jsonb),
  'constraints', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table', conrelid::regclass::text,
      'name', conname,
      'definition', pg_get_constraintdef(oid)
    ) order by conrelid::regclass::text, conname)
    from pg_constraint
    where connamespace = 'public'::regnamespace
      and conrelid in (
        'public.financial_goals'::regclass,
        'public.financial_goal_movements'::regclass,
        'public.financial_goal_recurring_rules'::regclass,
        'public.financial_accounts'::regclass,
        'public.movements'::regclass
      )
  ), '[]'::jsonb),
  'goal_functions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'returns', pg_get_function_result(p.oid)
    ) order by p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_goal_movement_multi_currency',
        'create_linked_goal_movement',
        'confirm_goal_movement_multi_currency',
        'correct_goal_movement_multi_currency',
        'delete_goal_movement_multi_currency',
        'process_financial_goal_recurring_rules_multi_currency'
      )
  ), '[]'::jsonb),
  'migration_history_table_exists',
    to_regclass('supabase_migrations.schema_migrations') is not null
) as goal_movement_schema_audit;
