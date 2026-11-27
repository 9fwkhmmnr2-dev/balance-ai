-- Keep VERA plan subscriptions adult-only while aligning the legal versions
-- with the current acceptance flow.
DROP POLICY IF EXISTS require_adult_legal_acceptance ON public.user_plan_subscriptions;
CREATE POLICY require_adult_legal_acceptance
ON public.user_plan_subscriptions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.registration_acceptances ra
    WHERE ra.user_id = (SELECT auth.uid())
      AND ra.age_eligible = true
      AND ra.terms_version = '2026-11-26-draft-3'
      AND ra.privacy_version = '2026-11-26-draft-3'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.registration_acceptances ra
    WHERE ra.user_id = (SELECT auth.uid())
      AND ra.age_eligible = true
      AND ra.terms_version = '2026-11-26-draft-3'
      AND ra.privacy_version = '2026-11-26-draft-3'
  )
);
