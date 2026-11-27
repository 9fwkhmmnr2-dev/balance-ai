-- Let authenticated users access their own personal-finance workspace without an age gate.
-- Keep legal acceptance and row ownership checks; social and billing tables retain their existing policy.

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT schemaname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'require_adult_legal_acceptance'
      AND tablename = ANY (ARRAY[
        'account_transfers',
        'financial_accounts',
        'financial_commitments',
        'financial_goal_contributions',
        'financial_goal_movements',
        'financial_goal_recurring_rules',
        'financial_goals',
        'financial_profiles',
        'movements',
        'wrapped_views'
      ])
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', 'require_adult_legal_acceptance', item.schemaname, item.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated
       USING (EXISTS (
         SELECT 1 FROM public.registration_acceptances ra
         WHERE ra.user_id = (SELECT auth.uid())
           AND ra.terms_version = %L
           AND ra.privacy_version = %L
       ))
       WITH CHECK (EXISTS (
         SELECT 1 FROM public.registration_acceptances ra
         WHERE ra.user_id = (SELECT auth.uid())
           AND ra.terms_version = %L
           AND ra.privacy_version = %L
       ))',
      'require_legal_acceptance',
      item.schemaname,
      item.tablename,
      '2026-11-26-draft-3',
      '2026-11-26-draft-3',
      '2026-11-26-draft-3',
      '2026-11-26-draft-3'
    );
  END LOOP;
END $$;

-- The age flag is retained only for backwards compatibility and is no longer an access decision.
ALTER TABLE public.registration_acceptances
  ALTER COLUMN age_eligible SET DEFAULT false;

COMMENT ON COLUMN public.registration_acceptances.age_eligible IS
  'Legacy compatibility field. Not used to determine access to personal-finance features.';

-- Allow users to record/update only their own legal acceptance and optional AI consent.
GRANT SELECT ON public.registration_acceptances TO authenticated;
GRANT INSERT (user_id, terms_version, privacy_version, ai_data_consent, ai_consent_version, accepted_at, updated_at)
  ON public.registration_acceptances TO authenticated;
GRANT UPDATE (terms_version, privacy_version, ai_data_consent, ai_consent_version, accepted_at, updated_at)
  ON public.registration_acceptances TO authenticated;

DROP POLICY IF EXISTS "Users can insert their own registration acceptance" ON public.registration_acceptances;
CREATE POLICY "Users can insert their own registration acceptance"
  ON public.registration_acceptances
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own registration acceptance" ON public.registration_acceptances;
CREATE POLICY "Users can update their own registration acceptance"
  ON public.registration_acceptances
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
