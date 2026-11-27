-- Finance Friends is part of the adult-only Finance Track experience.
-- Replace stale draft-2 restrictive policies with the current draft-3 consent versions.
DO $$
DECLARE
  target_table text;
  policy_expression text := $policy$
    EXISTS (
      SELECT 1
      FROM public.registration_acceptances ra
      WHERE ra.user_id = (SELECT auth.uid())
        AND ra.age_eligible = true
        AND ra.terms_version = '2026-11-26-draft-3'
        AND ra.privacy_version = '2026-11-26-draft-3'
    )
  $policy$;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'social_profiles',
    'social_directory',
    'friendships',
    'friend_aliases',
    'user_achievements',
    'achievement_catalog'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'require_adult_legal_acceptance', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      'require_adult_legal_acceptance',
      target_table,
      policy_expression,
      policy_expression
    );
  END LOOP;
END
$$;
