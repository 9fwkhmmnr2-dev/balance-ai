do $$
declare
  target record;
  policy_name text := 'require_adult_legal_acceptance';
begin
  for target in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename <> 'registration_acceptances'
  loop
    execute format('drop policy if exists %I on public.%I', policy_name, target.tablename);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (exists (select 1 from public.registration_acceptances ra where ra.user_id = (select auth.uid()) and ra.age_eligible = true and ra.terms_version = %L and ra.privacy_version = %L)) with check (exists (select 1 from public.registration_acceptances ra where ra.user_id = (select auth.uid()) and ra.age_eligible = true and ra.terms_version = %L and ra.privacy_version = %L))',
      policy_name, target.tablename,
      '2026-11-26-draft-2', '2026-11-26-draft-2',
      '2026-11-26-draft-2', '2026-11-26-draft-2'
    );
  end loop;
end $$;
