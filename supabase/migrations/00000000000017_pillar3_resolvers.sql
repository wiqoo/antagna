-- Pillar 3 §6 — resolver functions (SECURITY DEFINER to avoid RLS recursion).
--
-- These are the only function calls feature pillars should make from RLS:
--   public.has_permission(p_profile_id uuid, p_key text)
--   public.has_capability(p_profile_id uuid, p_capability_key text)
--   public.is_assigned_to_project(p_profile_id uuid, p_project_id uuid)
--
-- Plus current_user_* wrappers for convenience inside policies.

-- ── has_permission ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_permission(p_profile_id uuid, p_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text;
  v_override boolean;
BEGIN
  IF p_profile_id IS NULL THEN RETURN false; END IF;

  -- 1. Per-user override (highest precedence; respects expiry).
  SELECT granted INTO v_override
  FROM public.user_permission_overrides
  WHERE profile_id = p_profile_id
    AND permission_key = p_key
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  IF FOUND THEN RETURN v_override; END IF;

  -- 2. system_admin bypass.
  SELECT role INTO v_role FROM public.profiles WHERE id = p_profile_id;
  IF v_role = 'system_admin' THEN RETURN true; END IF;

  -- 3. Role default.
  RETURN EXISTS (
    SELECT 1 FROM public.role_default_permissions
    WHERE role = v_role AND permission_key = p_key
  );
END;
$$;

-- ── has_capability ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_capability(p_profile_id uuid, p_capability_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_capabilities
    WHERE profile_id = p_profile_id
      AND capability_key = p_capability_key
  );
$$;

-- ── is_assigned_to_project ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_assigned_to_project(p_profile_id uuid, p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_assignments
    WHERE project_id = p_project_id AND profile_id = p_profile_id
  ) OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id
      AND (account_manager_id   = p_profile_id
        OR project_manager_id   = p_profile_id
        OR production_manager_id = p_profile_id
        OR created_by           = p_profile_id)
  );
$$;

-- ── current_user_* wrappers ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission(public.current_profile_id(), p_key);
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_capability(p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_capability(public.current_profile_id(), p_key);
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_assigned_to_project(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_assigned_to_project(public.current_profile_id(), p_project_id);
$$;

-- ── extend is_admin_caller (from Pillar 1) — system_admin OR has admin perm ──

CREATE OR REPLACE FUNCTION public.is_admin_caller()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role() IN ('system_admin', 'system_manager'), false);
$$;
