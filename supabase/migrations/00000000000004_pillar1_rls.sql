-- Pillar 1 — RLS baseline (§8.4)
-- Every table needs RLS enabled. Pillar 1 provides minimal, restrictive defaults;
-- feature pillars relax them per their access matrix.

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_limits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memory_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings  ENABLE ROW LEVEL SECURITY;

-- ── profiles ────────────────────────────────────────────────────────────────────

-- Read: self or admin caller
DROP POLICY IF EXISTS profiles_read       ON public.profiles;
CREATE POLICY profiles_read ON public.profiles
  FOR SELECT
  USING (auth.uid() = auth_user_id OR public.is_admin_caller());

-- Update: self (cannot escalate role — enforced in a trigger per Pillar 16 §B.4)
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- Admin: full write
DROP POLICY IF EXISTS profiles_admin_write ON public.profiles;
CREATE POLICY profiles_admin_write ON public.profiles
  FOR ALL
  USING (public.is_admin_caller())
  WITH CHECK (public.is_admin_caller());

-- Per Pillar 16 §B.4: prevent role escalation via a trigger (RLS can't see OLD.role)
CREATE OR REPLACE FUNCTION public.fn_block_self_role_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- Service-role / admin callers bypass.
  IF public.is_admin_caller() THEN
    RETURN NEW;
  END IF;

  v_caller_role := public.current_role();

  -- Self-update path: role and auth_user_id are immutable for non-admins.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot change role on self (current=%, attempted=%)', OLD.role, NEW.role
      USING ERRCODE = '42501';
  END IF;
  IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    RAISE EXCEPTION 'Cannot change auth_user_id on self'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_block_self_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_block_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_self_role_escalation();

-- ── audit_log ───────────────────────────────────────────────────────────────────

-- Reads: admin only. (Pillar 11 may relax for "your own actions".)
DROP POLICY IF EXISTS audit_log_admin_read ON public.audit_log;
CREATE POLICY audit_log_admin_read ON public.audit_log
  FOR SELECT USING (public.is_admin_caller());

-- Writes: only via SECURITY DEFINER triggers (fn_audit_row_change).
-- No INSERT/UPDATE/DELETE policies → blocks direct writes from authenticated.

-- ── ai_usage ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ai_usage_self_read ON public.ai_usage;
CREATE POLICY ai_usage_self_read ON public.ai_usage
  FOR SELECT USING (
    user_id = public.current_profile_id() OR public.is_admin_caller()
  );

-- INSERT happens via service-role from worker — no policy for authenticated.

-- ── ai_user_limits ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ai_user_limits_self_read  ON public.ai_user_limits;
CREATE POLICY ai_user_limits_self_read ON public.ai_user_limits
  FOR SELECT USING (
    user_id = public.current_profile_id() OR public.is_admin_caller()
  );

DROP POLICY IF EXISTS ai_user_limits_admin_write ON public.ai_user_limits;
CREATE POLICY ai_user_limits_admin_write ON public.ai_user_limits
  FOR ALL USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());

-- ── ai_memory_chunks ────────────────────────────────────────────────────────────

-- Read your own user-scope chunks + company-scope chunks; admin sees all.
DROP POLICY IF EXISTS ai_memory_chunks_read ON public.ai_memory_chunks;
CREATE POLICY ai_memory_chunks_read ON public.ai_memory_chunks
  FOR SELECT USING (
    public.is_admin_caller()
    OR (scope = 'company')
    OR (scope = 'user' AND scope_id = public.current_profile_id())
  );

-- Writes via service-role (worker embed pipeline).

-- ── system_settings ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS system_settings_admin_only ON public.system_settings;
CREATE POLICY system_settings_admin_only ON public.system_settings
  FOR ALL USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());

-- Authenticated users can read non-secret keys (e.g. branding) — relaxed later.
DROP POLICY IF EXISTS system_settings_public_read ON public.system_settings;
CREATE POLICY system_settings_public_read ON public.system_settings
  FOR SELECT USING (
    key LIKE 'public.%'
  );
