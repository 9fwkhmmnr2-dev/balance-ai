-- Per-user watchlist for markets, indices, companies and assets.
CREATE TABLE IF NOT EXISTS public.market_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_key text NOT NULL CHECK (char_length(market_key) BETWEEN 3 AND 120),
  item_type text NOT NULL CHECK (item_type IN ('market', 'index', 'company', 'asset')),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 160),
  symbol text,
  country_code text CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{3}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, market_key)
);

CREATE INDEX IF NOT EXISTS market_favorites_user_created_idx
  ON public.market_favorites (user_id, created_at DESC);

ALTER TABLE public.market_favorites ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.market_favorites FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.market_favorites FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.market_favorites TO authenticated;

DROP POLICY IF EXISTS market_favorites_select_own ON public.market_favorites;
CREATE POLICY market_favorites_select_own
  ON public.market_favorites FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS market_favorites_insert_own ON public.market_favorites;
CREATE POLICY market_favorites_insert_own
  ON public.market_favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS market_favorites_delete_own ON public.market_favorites;
CREATE POLICY market_favorites_delete_own
  ON public.market_favorites FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
