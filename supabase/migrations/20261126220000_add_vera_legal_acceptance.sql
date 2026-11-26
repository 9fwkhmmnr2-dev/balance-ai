ALTER TABLE public.registration_acceptances
  ADD COLUMN IF NOT EXISTS vera_terms_version text,
  ADD COLUMN IF NOT EXISTS vera_privacy_version text,
  ADD COLUMN IF NOT EXISTS vera_accepted_at timestamptz;

GRANT SELECT (vera_terms_version, vera_privacy_version, vera_accepted_at)
  ON TABLE public.registration_acceptances TO authenticated;
GRANT UPDATE (vera_terms_version, vera_privacy_version, vera_accepted_at)
  ON TABLE public.registration_acceptances TO authenticated;

COMMENT ON COLUMN public.registration_acceptances.vera_terms_version IS
  'Version of VERA-specific terms accepted by this user.';
COMMENT ON COLUMN public.registration_acceptances.vera_privacy_version IS
  'Version of VERA-specific privacy notice accepted by this user.';
COMMENT ON COLUMN public.registration_acceptances.vera_accepted_at IS
  'Timestamp when the user accepted VERA terms and privacy notice.';
