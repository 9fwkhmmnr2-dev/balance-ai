-- Remove permissive legal-acceptance policies that could broaden access
-- beyond each table's existing owner-scoped policies.
-- Age, current terms, and AI consent remain enforced by VERA's server gate
-- and restrictive policies on vera_conversations / vera_memories.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'require_legal_acceptance'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Transfers are created through this ownership-checking RPC only.
REVOKE ALL ON FUNCTION public.create_account_transfer(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_account_transfer(uuid, uuid, numeric) TO authenticated;
