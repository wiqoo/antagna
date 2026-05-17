-- Pillar 2 §3.7 + §11 — triggers + RLS for People + Organizations.
-- Audit trigger (fn_audit_row_change from Pillar 1) gets attached to every
-- meaningful table; updated_at trigger (fn_touch_updated_at) on every table
-- with an updated_at column.

-- ── audit + updated_at on every Pillar 2 stage-1 table ────────────────────────

DO $$
DECLARE
  t text;
  has_updated_at boolean;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'employees',
      'capabilities',
      'user_capabilities',
      'skills',
      'user_skills',
      'departments',
      'work_calendar_defaults',
      'squads',
      'squad_members',
      'talents',
      'freelancers',
      'clients',
      'agency_brand_links',
      'contacts',
      'contact_methods',
      'locations'
    ])
  LOOP
    -- audit trigger
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I; ' ||
      'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();',
      t, t, t, t
    );

    -- updated_at trigger (only if the table has an updated_at column)
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
    ) INTO has_updated_at;

    IF has_updated_at THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON public.%I; ' ||
        'CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON public.%I ' ||
        'FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();',
        t, t, t, t
      );
    END IF;
  END LOOP;
END $$;

-- ── RLS — enable on every new Pillar 2 stage-1 table ──────────────────────────

ALTER TABLE public.employees             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capabilities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_capabilities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_calendar_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_brand_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_methods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations             ENABLE ROW LEVEL SECURITY;

-- ── Read policies — every authenticated user can read these ───────────────────
-- These are operational reference data; the @mention picker, the assignment
-- selector, the client list, etc. all need broad read.

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'employees','capabilities','user_capabilities','skills','user_skills',
    'departments','work_calendar_defaults','squads','squad_members',
    'talents','freelancers','clients','agency_brand_links','contacts',
    'contact_methods','locations'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I; '
      || 'CREATE POLICY %I ON public.%I FOR SELECT '
      || 'USING (auth.role() = ''authenticated'' OR public.is_admin_caller());',
      t || '_read', t, t || '_read', t
    );
  END LOOP;
END $$;

-- ── Write policies — admin caller only for now ────────────────────────────────
-- Pillar 3 (Identity & Permissions) will refine these with proper role-based
-- writes (HR can write employees, AM can write contacts, etc.). Until then,
-- service_role + admin pattern keeps things safe.

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'employees','capabilities','user_capabilities','skills','user_skills',
    'departments','work_calendar_defaults','squads','squad_members',
    'talents','freelancers','clients','agency_brand_links','contacts',
    'contact_methods','locations'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I; '
      || 'CREATE POLICY %I ON public.%I FOR ALL '
      || 'USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());',
      t || '_admin_write', t, t || '_admin_write', t
    );
  END LOOP;
END $$;

-- ── work_calendar_defaults: self can read own ─────────────────────────────────

DROP POLICY IF EXISTS work_calendar_defaults_self_read ON public.work_calendar_defaults;
CREATE POLICY work_calendar_defaults_self_read ON public.work_calendar_defaults
  FOR SELECT USING (profile_id = public.current_profile_id() OR public.is_admin_caller());
