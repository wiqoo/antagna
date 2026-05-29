-- /admin/feedback — lightweight internal feedback inbox.
-- Team feedback / bug reports / feature requests. Triaged by admins gated on
-- the existing `access.manage` permission (no new permission key required —
-- the admin pages reuse access.manage). Drizzle definition lives in
-- packages/db/src/schema/cross_cutting.ts (export `feedback`).

CREATE TABLE IF NOT EXISTS public.feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  category    text NOT NULL DEFAULT 'general',  -- 'bug' | 'feature' | 'general' | 'ux'
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'open',      -- 'open' | 'in_review' | 'resolved' | 'dismissed'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_status_idx  ON public.feedback (status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_profile_idx ON public.feedback (profile_id);

-- The app accesses Postgres as the service-role key (bypasses RLS), and the
-- TS authz layer (lib/authz.can('access.manage')) is the real gate. RLS is
-- still enabled for defense-in-depth so anon/auth roles can't read it directly.
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
