-- 065 — Dashboard board cache (precompute + serve-from-cache architecture)
--
-- The dashboard board fans out many DB queries on every load (slow on cold
-- start). Instead we compute the board DATA (not React nodes) once, cache the
-- JSON per profile, and serve it instantly; a background worker refreshes it,
-- and a manual "refresh" recomputes on demand. The page renders nodes from the
-- cached payload — no query storm on the request path.

CREATE TABLE IF NOT EXISTS public.dashboard_board_cache (
  profile_id   uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  payload      jsonb NOT NULL,
  computed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_board_cache_computed_idx
  ON public.dashboard_board_cache (computed_at);
