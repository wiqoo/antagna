-- Pillar 1 — helper functions + reusable audit trigger (§8.4, §8.5)

-- ── Helpers (reusable across every pillar's RLS) ────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin_caller()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role() IN ('system_admin', 'general_manager');
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid();
$$;

-- ── Audit trigger (attach to every important table) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_email text;
BEGIN
  v_actor_id := public.current_profile_id();
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = v_actor_id;

  INSERT INTO public.audit_log (actor_id, actor_email, action, entity_type, entity_id, before_data, after_data)
  VALUES (
    v_actor_id,
    v_actor_email,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::jsonb END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::jsonb END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── updated_at maintenance ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Attach updated_at trigger + audit trigger to profiles
DROP TRIGGER IF EXISTS trg_profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_audit ON public.profiles;
CREATE TRIGGER trg_profiles_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();

DROP TRIGGER IF EXISTS trg_system_settings_touch_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_touch_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ai_user_limits_touch_updated_at ON public.ai_user_limits;
CREATE TRIGGER trg_ai_user_limits_touch_updated_at
  BEFORE UPDATE ON public.ai_user_limits
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
