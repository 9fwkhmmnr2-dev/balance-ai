-- Expose only directory fields for username discovery. Full profile details
-- are visible only to the owner and accepted friends.
CREATE TABLE IF NOT EXISTS public.social_directory (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text NOT NULL CHECK (char_length(display_name) <= 32),
  avatar_id text NOT NULL CHECK (avatar_id ~ '^avatar-(0[1-9]|1[0-9])$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_directory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_directory FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.social_directory TO authenticated;
DROP POLICY IF EXISTS "authenticated users search social directory" ON public.social_directory;
CREATE POLICY "authenticated users search social directory"
  ON public.social_directory FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.sync_social_directory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.username IS NULL OR btrim(NEW.username) = '' THEN
    DELETE FROM public.social_directory WHERE user_id = NEW.user_id;
    RETURN NEW;
  END IF;

  INSERT INTO public.social_directory (user_id, username, display_name, avatar_id, updated_at)
  VALUES (NEW.user_id, NEW.username, NEW.display_name, NEW.avatar_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        avatar_id = EXCLUDED.avatar_id,
        updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_social_directory() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS social_profiles_sync_directory ON public.social_profiles;
CREATE TRIGGER social_profiles_sync_directory
  AFTER INSERT OR UPDATE OF username, display_name, avatar_id
  ON public.social_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_social_directory();

INSERT INTO public.social_directory (user_id, username, display_name, avatar_id, updated_at)
SELECT user_id, username, display_name, avatar_id, now()
FROM public.social_profiles
WHERE username IS NOT NULL AND btrim(username) <> ''
ON CONFLICT (user_id) DO UPDATE
  SET username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      avatar_id = EXCLUDED.avatar_id,
      updated_at = now();

DROP POLICY IF EXISTS "social profiles readable by authenticated users" ON public.social_profiles;
DROP POLICY IF EXISTS "social profiles readable by self and accepted friends" ON public.social_profiles;
CREATE POLICY "social profiles readable by self and accepted friends"
  ON public.social_profiles FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = (SELECT auth.uid()) AND f.addressee_id = social_profiles.user_id)
          OR
          (f.addressee_id = (SELECT auth.uid()) AND f.requester_id = social_profiles.user_id)
        )
    )
  );
