-- Pillar 9 — Attendance (selfie + GPS audit trail, no face matching per §C.2)
-- + KPIs (definitions + snapshots).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_type') THEN
    CREATE TYPE attendance_type AS ENUM (
      'check_in_office','check_out_office',
      'check_in_shoot','check_out_shoot',
      'remote_start','remote_end',
      'leave_start','leave_end'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_verification') THEN
    CREATE TYPE attendance_verification AS ENUM (
      'verified',
      'flagged_pin_failed',
      'flagged_location_mismatch',
      'flagged_replay_suspected',
      'flagged_clock_skew',
      'manually_overridden'
    );
  END IF;
END $$;

-- ── geo_fences ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.geo_fences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar         text NOT NULL,
  name_en         text,
  center_lat      numeric(10,7) NOT NULL,
  center_lng      numeric(10,7) NOT NULL,
  radius_meters   integer NOT NULL DEFAULT 100,
  kind            text NOT NULL,
  client_id       uuid REFERENCES public.clients(id),
  active          boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS gf_kind_idx   ON public.geo_fences (kind);
CREATE INDEX IF NOT EXISTS gf_client_idx ON public.geo_fences (client_id);

-- ── attendance_records ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id                    uuid NOT NULL REFERENCES public.profiles(id),
  type                          attendance_type NOT NULL,
  selfie_url                    text NOT NULL,
  selfie_hash                   text,
  pin_verified                  boolean NOT NULL DEFAULT false,
  gps_lat                       numeric(10,7),
  gps_lng                       numeric(10,7),
  gps_accuracy_meters           numeric(8,2),
  resolved_location_label       text,
  geo_fence_id                  uuid REFERENCES public.geo_fences(id),
  client_timestamp              timestamptz,
  server_timestamp              timestamptz NOT NULL DEFAULT now(),
  time_delta_ms                 integer,
  associated_project_id         uuid REFERENCES public.projects(id),
  associated_calendar_event_id  text,
  verification                  attendance_verification NOT NULL,
  override_by_profile_id        uuid REFERENCES public.profiles(id),
  override_reason               text,
  device_info                   jsonb,
  created_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ar_profile_time_idx ON public.attendance_records (profile_id, server_timestamp DESC);
CREATE INDEX IF NOT EXISTS ar_verification_idx ON public.attendance_records (verification) WHERE verification <> 'verified';

-- Now that geo_fences exists, attach the FK from locations.geo_fence_id added in Pillar 2.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='locations' AND constraint_name='locations_geo_fence_fk'
  ) THEN
    ALTER TABLE public.locations
      ADD CONSTRAINT locations_geo_fence_fk
      FOREIGN KEY (geo_fence_id) REFERENCES public.geo_fences(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── KPI tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.kpi_definitions (
  key                 text PRIMARY KEY,
  name_ar             text NOT NULL,
  name_en             text,
  scope               text NOT NULL,                -- 'person' | 'project' | 'client' | 'company'
  unit                text NOT NULL,                -- 'count' | 'pct' | 'sar' | 'days'
  compute_sql         text,
  threshold_green     numeric(12,4),
  threshold_amber     numeric(12,4),
  refresh_frequency   text NOT NULL,
  active              boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.kpi_snapshots (
  id                  bigserial PRIMARY KEY,
  kpi_key             text NOT NULL REFERENCES public.kpi_definitions(key),
  scope_entity_type   text,
  scope_entity_id     uuid,
  period_start        text NOT NULL,
  period_end          text NOT NULL,
  value               numeric(14,4) NOT NULL,
  metadata            jsonb,
  computed_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kpi_snapshot_unique UNIQUE (kpi_key, scope_entity_type, scope_entity_id, period_start)
);

CREATE INDEX IF NOT EXISTS kpi_by_time ON public.kpi_snapshots (kpi_key, computed_at DESC);

-- ── seed KPI catalog ─────────────────────────────────────────────────────────

INSERT INTO public.kpi_definitions (key, name_ar, name_en, scope, unit, refresh_frequency) VALUES
  -- person
  ('attendance_present_pct',           'نسبة الحضور',               'Attendance present %',          'person',  'pct',   'daily'),
  ('shoots_completed_count',           'عدد التصويرات المنجزة',      'Shoots completed',              'person',  'count', 'weekly'),
  ('edits_delivered_on_time_pct',      'المونتاج في الوقت',           'Edits delivered on time %',    'person',  'pct',   'weekly'),
  ('tasks_completed_count',            'المهام المنجزة',              'Tasks completed',               'person',  'count', 'daily'),
  ('tasks_overdue_count',              'المهام المتأخرة',            'Tasks overdue',                 'person',  'count', 'realtime'),
  ('avg_response_time_hours',          'متوسط زمن الاستجابة',         'Avg response time (h)',         'person',  'count', 'hourly'),
  ('client_compliments_count',         'إشادات العملاء',              'Client compliments',            'person',  'count', 'weekly'),
  ('client_complaints_count',          'شكاوى العملاء',               'Client complaints',             'person',  'count', 'weekly'),
  -- project
  ('days_brief_to_quote',              'أيام من البريف للعرض',         'Days brief → quote',            'project', 'days',  'realtime'),
  ('days_quote_to_award',              'أيام من العرض للموافقة',       'Days quote → award',            'project', 'days',  'realtime'),
  ('revision_rounds_count',            'عدد جولات التعديل',           'Revision rounds',               'project', 'count', 'realtime'),
  ('on_time_delivery_bool',            'تسليم في الموعد',             'On-time delivery',              'project', 'count', 'realtime'),
  ('profit_margin_pct',                'هامش الربح',                  'Profit margin %',                'project', 'pct',   'daily'),
  ('team_size_count',                  'حجم الفريق',                  'Team size',                     'project', 'count', 'realtime'),
  -- client
  ('revenue_last_12mo_sar',            'إيرادات آخر 12 شهر',           'Revenue last 12mo SAR',         'client',  'sar',   'daily'),
  ('projects_count_last_12mo',         'عدد المشاريع آخر 12 شهر',      'Projects last 12mo',            'client',  'count', 'daily'),
  ('avg_payment_days',                 'متوسط أيام السداد',            'Avg payment days',              'client',  'days',  'daily'),
  ('repeat_rate',                      'نسبة تكرار العميل',           'Repeat rate %',                 'client',  'pct',   'weekly'),
  ('nps_avg',                          'متوسط NPS',                   'NPS avg',                       'client',  'count', 'weekly'),
  -- company
  ('monthly_active_projects',          'المشاريع النشطة شهرياً',       'Monthly active projects',       'company', 'count', 'hourly'),
  ('monthly_revenue_sar',              'الإيرادات الشهرية',           'Monthly revenue SAR',           'company', 'sar',   'daily'),
  ('pipeline_value_sar',               'قيمة Pipeline',               'Pipeline value SAR',            'company', 'sar',   'hourly'),
  ('team_utilization_pct',             'استغلال الفريق',              'Team utilization %',            'company', 'pct',   'daily'),
  ('top_client_concentration_pct',     'تركيز كبار العملاء',           'Top-client concentration %',    'company', 'pct',   'weekly')
ON CONFLICT (key) DO NOTHING;

-- ── audit + RLS ──────────────────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['geo_fences','attendance_records','kpi_definitions','kpi_snapshots'])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I; ' ||
      'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();',
      t, t, t, t
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I; '
      || 'CREATE POLICY %I ON public.%I FOR SELECT '
      || 'USING (auth.role() = ''authenticated'' OR public.is_admin_caller());',
      t || '_read', t, t || '_read', t
    );
  END LOOP;
END $$;

-- attendance_records: insert by the authenticated user themselves (self check-in)
-- + admin override.
DROP POLICY IF EXISTS attendance_self_insert ON public.attendance_records;
CREATE POLICY attendance_self_insert ON public.attendance_records
  FOR INSERT WITH CHECK (
    profile_id = public.current_profile_id() OR public.is_admin_caller()
  );

DROP POLICY IF EXISTS attendance_admin_update ON public.attendance_records;
CREATE POLICY attendance_admin_update ON public.attendance_records
  FOR UPDATE USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());

-- geo_fences + kpi_* — admin/equipment_manager writes.
DROP POLICY IF EXISTS geo_fences_admin_write ON public.geo_fences;
CREATE POLICY geo_fences_admin_write ON public.geo_fences
  FOR ALL USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());

DROP POLICY IF EXISTS kpi_definitions_admin_write ON public.kpi_definitions;
CREATE POLICY kpi_definitions_admin_write ON public.kpi_definitions
  FOR ALL USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());

-- kpi_snapshots: writes via service-role only (the worker job).
DROP POLICY IF EXISTS kpi_snapshots_admin_write ON public.kpi_snapshots;
CREATE POLICY kpi_snapshots_admin_write ON public.kpi_snapshots
  FOR ALL USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());
