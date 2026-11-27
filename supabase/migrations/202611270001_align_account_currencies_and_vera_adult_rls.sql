-- Keep the account currency constraint aligned with the ISO currency picker.
-- The UI exposes ISO currency codes beyond the original ARS/USD/EUR subset.
ALTER TABLE public.financial_accounts
  DROP CONSTRAINT IF EXISTS financial_accounts_currency_check;

ALTER TABLE public.financial_accounts
  ADD CONSTRAINT financial_accounts_currency_check
  CHECK (
    currency ~ '^[A-Z]{3}$'
    AND currency NOT IN ('XAU', 'XAG', 'XPT', 'XPD', 'XDR')
  );

-- VERA's restrictive RLS policies previously required draft-2 legal versions,
-- while the current acceptance flow writes draft-3. Keep VERA adult-only and
-- require current product terms, VERA terms, and explicit Gemini data consent.
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
        AND ra.ai_data_consent = true
        AND ra.ai_consent_version = 'gemini-processing-draft-2'
        AND ra.vera_terms_version = '2026-11-26-draft-3'
        AND ra.vera_privacy_version = '2026-11-26-draft-3'
    )
  $policy$;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['vera_conversations', 'vera_memories']
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
