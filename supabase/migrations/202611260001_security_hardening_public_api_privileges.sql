-- Security hardening for the public API surface.
-- Remove accidental anonymous access and scope owner policies to signed-in users.
REVOKE ALL PRIVILEGES ON TABLE public.movements, public.financial_profiles FROM anon;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND roles = ARRAY['public']::name[]
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated',
      p.policyname, p.schemaname, p.tablename);
  END LOOP;
END
$$;

-- RLS does not protect TRUNCATE, trigger creation, or REFERENCES privileges.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated, PUBLIC;

-- Avoid broad grants on objects created later by postgres in public.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;

-- These per-user RPCs verify auth.uid() = p_user_id. Run as caller so RLS
-- remains an independent authorization boundary.
ALTER FUNCTION public.confirm_goal_movement_multi_currency(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.confirm_linked_goal_movement(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.correct_goal_movement_multi_currency(uuid, uuid, numeric, text, text, date) SECURITY INVOKER;
ALTER FUNCTION public.correct_linked_goal_movement(uuid, uuid, numeric, text, text, date) SECURITY INVOKER;
ALTER FUNCTION public.create_goal_movement_multi_currency(uuid, uuid, text, numeric, text, text, text, date, uuid, text, uuid, date, text, text, numeric, numeric, text, timestamptz) SECURITY INVOKER;
ALTER FUNCTION public.create_linked_goal_movement(uuid, uuid, text, numeric, text, text, date, uuid, text, uuid, date, text, text) SECURITY INVOKER;
ALTER FUNCTION public.delete_goal_movement_multi_currency(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.delete_linked_manual_goal_movement(uuid, uuid) SECURITY INVOKER;

-- Intentional SECURITY DEFINER: direct client INSERT on account_transfers is
-- not granted. This RPC derives the actor from auth.uid(), validates ownership
-- of both accounts, active status, same currency, amount precision and balance.
COMMENT ON FUNCTION public.create_account_transfer(uuid, uuid, numeric) IS
  'Intentional SECURITY DEFINER RPC. It derives the actor from auth.uid(), verifies ownership and state of both accounts, checks same currency, precision and available balance, and writes the transfer atomically. Direct INSERT on account_transfers remains unavailable to clients.';
