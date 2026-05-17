-- Pillar 4 §3 — CRM schema additions.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
    CREATE TYPE lead_status AS ENUM ('new','qualified','nurturing','proposal_sent','won','lost','ghosted');
  END IF;
END $$;

-- ── leads ─────────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS lead_code_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.fn_next_lead_code()
RETURNS text LANGUAGE sql AS $$
  SELECT 'LEAD-' || LPAD(nextval('lead_code_seq')::text, 4, '0');
$$;

CREATE TABLE IF NOT EXISTS public.leads (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text NOT NULL UNIQUE DEFAULT public.fn_next_lead_code(),
  source                   text,
  source_detail            text,
  received_at              timestamptz NOT NULL DEFAULT now(),
  inbound_email_message_id text,
  inbound_thread_id        text,
  client_id                uuid REFERENCES public.clients(id),
  contact_id               uuid REFERENCES public.contacts(id),
  unmatched_from_email     text,
  unmatched_from_name      text,
  status                   lead_status NOT NULL DEFAULT 'new',
  estimated_value_sar      numeric(12,2),
  temperature_score        integer,
  ai_summary               text,
  ai_suggested_action      text,
  ai_analyzed_at           timestamptz,
  converted_to_project_id  uuid REFERENCES public.projects(id),
  lost_reason              text,
  lost_at                  timestamptz,
  assigned_to_profile_id   uuid REFERENCES public.profiles(id),
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_status_idx     ON public.leads (status);
CREATE INDEX IF NOT EXISTS leads_client_idx     ON public.leads (client_id);
CREATE INDEX IF NOT EXISTS leads_assignee_idx   ON public.leads (assigned_to_profile_id);
CREATE INDEX IF NOT EXISTS leads_received_idx   ON public.leads (received_at DESC);

-- ── client_assignments ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profiles(id),
  role        text NOT NULL,           -- 'primary_am' | 'secondary_am' | 'pm_alias' | 'observer'
  active      boolean NOT NULL DEFAULT true,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz
);

-- One and only one primary_am per client at a time.
CREATE UNIQUE INDEX IF NOT EXISTS client_one_primary_am
  ON public.client_assignments (client_id)
  WHERE role = 'primary_am' AND active = true;

CREATE INDEX IF NOT EXISTS ca_profile_idx ON public.client_assignments (profile_id);

-- ── client_health_snapshots ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_health_snapshots (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                uuid NOT NULL REFERENCES public.clients(id),
  snapshot_date            text NOT NULL,
  total_revenue_sar        numeric(14,2),
  total_projects_count     integer,
  active_projects_count    integer,
  lost_projects_count      integer,
  average_payment_days     integer,
  outstanding_ar_sar       numeric(14,2),
  last_project_at          timestamptz,
  days_since_last_project  integer,
  retainer_status          text,
  computed_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_health_per_day UNIQUE (client_id, snapshot_date)
);

-- ── inbound_email_routes ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inbound_email_routes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position              integer NOT NULL DEFAULT 0,
  match_from_contains   text,
  match_to_contains     text,
  match_subject_regex   text,
  match_domain          text,
  assign_to_profile_id  uuid REFERENCES public.profiles(id),
  set_label_key         text,
  set_status            text,
  create_lead_if_new    boolean NOT NULL DEFAULT true,
  notify_channel        text,
  active                boolean NOT NULL DEFAULT true,
  description           text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ier_position_idx ON public.inbound_email_routes (position) WHERE active = true;

-- ── audit + updated_at + RLS ─────────────────────────────────────────────────

DO $$
DECLARE
  t text;
  has_updated_at boolean;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'leads','client_assignments','client_health_snapshots','inbound_email_routes'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I; ' ||
      'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();',
      t, t, t, t
    );

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

ALTER TABLE public.leads                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_health_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_email_routes     ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user can see leads / assignments / health / routes.
-- Write: client.create / client.update permission gates leads + assignments;
-- admin-only for routes + health snapshots (the cron job writes via service-role).

DROP POLICY IF EXISTS leads_read ON public.leads;
CREATE POLICY leads_read ON public.leads
  FOR SELECT USING (auth.role() = 'authenticated' OR public.is_admin_caller());

DROP POLICY IF EXISTS leads_write ON public.leads;
CREATE POLICY leads_write ON public.leads
  FOR ALL USING (
    public.current_user_has_permission('client.create')
    OR public.current_user_has_permission('client.update')
  )
  WITH CHECK (
    public.current_user_has_permission('client.create')
    OR public.current_user_has_permission('client.update')
  );

DROP POLICY IF EXISTS ca_read ON public.client_assignments;
CREATE POLICY ca_read ON public.client_assignments
  FOR SELECT USING (auth.role() = 'authenticated' OR public.is_admin_caller());

DROP POLICY IF EXISTS ca_write ON public.client_assignments;
CREATE POLICY ca_write ON public.client_assignments
  FOR ALL USING (public.current_user_has_permission('client.update') OR public.is_admin_caller())
  WITH CHECK (public.current_user_has_permission('client.update') OR public.is_admin_caller());

DROP POLICY IF EXISTS chs_read ON public.client_health_snapshots;
CREATE POLICY chs_read ON public.client_health_snapshots
  FOR SELECT USING (auth.role() = 'authenticated' OR public.is_admin_caller());

DROP POLICY IF EXISTS chs_admin_write ON public.client_health_snapshots;
CREATE POLICY chs_admin_write ON public.client_health_snapshots
  FOR ALL USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());

DROP POLICY IF EXISTS ier_read ON public.inbound_email_routes;
CREATE POLICY ier_read ON public.inbound_email_routes
  FOR SELECT USING (auth.role() = 'authenticated' OR public.is_admin_caller());

DROP POLICY IF EXISTS ier_admin_write ON public.inbound_email_routes;
CREATE POLICY ier_admin_write ON public.inbound_email_routes
  FOR ALL USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());
