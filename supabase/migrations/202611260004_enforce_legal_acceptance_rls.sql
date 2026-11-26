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
      'create policy %I on public.%I as restrictive for all to authenticated using (exists (select 1 from public.registration_acceptances ra where ra.user_id = (select auth.uid()) and ra.age_eligible = true)) with check (exists (select 1 from public.registration_acceptances ra where ra.user_id = (select auth.uid()) and ra.age_eligible = true))',
      policy_name, target.tablename
    );
  end loop;
end $$;

comment on policy require_adult_legal_acceptance on public.movements is
'Restrictive gate: authenticated users must have a server-recorded adult age check and current legal acceptance before any app data access. Apply equivalent policy to all other public tables.';
