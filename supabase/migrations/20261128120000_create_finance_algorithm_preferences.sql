create table if not exists public.finance_algorithm_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  algorithm_mode text not null default 'on-demand'
    check (algorithm_mode in ('automatic', 'on-demand', 'follow-up', 'deep')),
  priorities text[] not null default array['saving', 'expense_organization']::text[],
  alert_intensity text not null default 'balanced'
    check (alert_intensity in ('important_only', 'balanced', 'detailed')),
  operation_types text[] not null default array['saving_plan', 'expense_review']::text[],
  interests text[] not null default '{}'::text[],
  personalization_enabled boolean not null default true,
  ai_assistance_consent boolean not null default false,
  cross_module_data_consent boolean not null default false,
  adaptive_learning_consent boolean not null default false,
  consent_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_algorithm_preferences_priorities_valid
    check (priorities <@ array['saving', 'expense_organization', 'debt_management', 'cost_reduction', 'purchase_planning']::text[]),
  constraint finance_algorithm_preferences_operations_valid
    check (operation_types <@ array['saving_plan', 'expense_review', 'debt_review', 'purchase_planning', 'price_tracking', 'goal_follow_up']::text[])
);

alter table public.finance_algorithm_preferences enable row level security;

drop policy if exists "Users can view their own algorithm preferences" on public.finance_algorithm_preferences;
create policy "Users can view their own algorithm preferences"
  on public.finance_algorithm_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own algorithm preferences" on public.finance_algorithm_preferences;
create policy "Users can insert their own algorithm preferences"
  on public.finance_algorithm_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own algorithm preferences" on public.finance_algorithm_preferences;
create policy "Users can update their own algorithm preferences"
  on public.finance_algorithm_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own algorithm preferences" on public.finance_algorithm_preferences;
create policy "Users can delete their own algorithm preferences"
  on public.finance_algorithm_preferences for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.finance_algorithm_preferences to authenticated;
