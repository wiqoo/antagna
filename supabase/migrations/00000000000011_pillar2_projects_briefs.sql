-- Pillar 2 §5-§6: Projects + Briefs + Deliverables + Revisions.
-- Plus Pillar 16 §B.3 (no share_token), §N (internal approval workflow),
-- §O.1 (Dafterah refs), §D.3 (freelancer_id on assignments).

-- ── enums ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_stage') THEN
    CREATE TYPE project_stage AS ENUM (
      'lead','brief','quoted','approved','planning','shooting','editing',
      'review','delivered','archived','lost','cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_type') THEN
    CREATE TYPE project_type AS ENUM (
      'shoot','edit_only','live_coverage','content_creation','consulting','other'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_assignment_role') THEN
    CREATE TYPE project_assignment_role AS ENUM (
      'account_manager','project_manager','production_manager',
      'shooter_lead','shooter','editor_lead','editor',
      'colorist','sound_engineer','drone_pilot','talent',
      'stylist','makeup','art_director','production_assistant',
      'freelancer_other'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('pending','in_progress','blocked','completed','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE task_priority AS ENUM ('low','normal','high','urgent');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deliverable_status') THEN
    -- Per Pillar 16 §N.3 — extended state machine for the internal approval flow.
    CREATE TYPE deliverable_status AS ENUM (
      'draft','submitted',
      'pending_director','pending_am',
      'revisions_director','revisions_am',
      'client_ready','in_client_review','revisions_client',
      'delivered','cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'internal_approval_stage') THEN
    CREATE TYPE internal_approval_stage AS ENUM (
      'director','account_manager','production_manager','custom'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'internal_approval_status') THEN
    CREATE TYPE internal_approval_status AS ENUM (
      'pending','approved','revisions_requested','skipped','auto_advanced'
    );
  END IF;
END $$;

-- ── sequence for PRJ-NNNN codes ───────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS project_code_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.fn_next_project_code()
RETURNS text LANGUAGE sql AS $$
  SELECT 'PRJ-' || LPAD(nextval('project_code_seq')::text, 4, '0');
$$;

-- ── projects ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text NOT NULL UNIQUE DEFAULT public.fn_next_project_code(),
  title                    text NOT NULL,
  title_ar                 text,
  description              text,
  project_type             project_type NOT NULL,
  stage                    project_stage NOT NULL DEFAULT 'brief',

  client_id                uuid NOT NULL REFERENCES public.clients(id),
  agency_id                uuid REFERENCES public.clients(id),
  agency_contact_id        uuid REFERENCES public.contacts(id),
  primary_contact_id       uuid REFERENCES public.contacts(id),

  account_manager_id       uuid REFERENCES public.profiles(id),
  project_manager_id       uuid REFERENCES public.profiles(id),
  production_manager_id    uuid REFERENCES public.profiles(id),

  location_id              uuid REFERENCES public.locations(id),

  brief_received_at        timestamptz,
  quoted_at                timestamptz,
  approved_at              timestamptz,
  shoot_starts_at          timestamptz,
  shoot_ends_at            timestamptz,
  delivery_due_at          timestamptz,
  delivered_at             timestamptz,
  archived_at              timestamptz,

  lost_reason              text,
  post_mortem_notes        text,
  contracted_value_sar     numeric(12,2),

  ai_status_paragraph      text,
  ai_risk_level            text,
  ai_next_action           text,
  ai_analyzed_at           timestamptz,

  drive_folder_url         text,
  drive_folder_id          text,
  calendar_event_id        text,

  -- Pillar 16 §O.1 — Dafterah reference numbers (we don't generate invoices, just store refs)
  dafterah_quote_number    text,
  dafterah_invoice_number  text,
  dafterah_po_number       text,

  -- Pillar 16 §N.7 — internal approval flow config
  default_approval_flow    jsonb NOT NULL DEFAULT jsonb_build_object(
    'director_required', true,
    'am_required', true,
    'director_sla_hours', 24,
    'am_sla_hours', 24,
    'auto_advance_on_sla_breach', false
  ),

  recurrence_rule          text,
  recurrence_parent_id     uuid,
  next_occurrence_at       timestamptz,

  custom_fields            jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                    text,

  created_by               uuid REFERENCES public.profiles(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_client_idx   ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_agency_idx   ON public.projects (agency_id);
CREATE INDEX IF NOT EXISTS projects_stage_idx    ON public.projects (stage);
CREATE INDEX IF NOT EXISTS projects_am_idx       ON public.projects (account_manager_id);
CREATE INDEX IF NOT EXISTS projects_pm_idx       ON public.projects (project_manager_id);
CREATE INDEX IF NOT EXISTS projects_shoot_starts ON public.projects (shoot_starts_at);

-- Self-FK for recurrence parent
ALTER TABLE public.projects
  ADD CONSTRAINT projects_recurrence_parent_fk
    FOREIGN KEY (recurrence_parent_id) REFERENCES public.projects(id) ON DELETE SET NULL;

-- ── project_stages_log ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_stages_log (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_stage               project_stage,
  to_stage                 project_stage NOT NULL,
  changed_by               uuid REFERENCES public.profiles(id),
  changed_at               timestamptz NOT NULL DEFAULT now(),
  duration_in_prev_seconds integer,
  reason                   text,
  metadata                 jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS project_stages_log_project_idx ON public.project_stages_log (project_id, changed_at DESC);

-- Trigger: log every stage transition
CREATE OR REPLACE FUNCTION public.fn_log_project_stage()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  prev_change_at timestamptz;
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    SELECT changed_at INTO prev_change_at
      FROM public.project_stages_log
      WHERE project_id = NEW.id
      ORDER BY changed_at DESC LIMIT 1;

    INSERT INTO public.project_stages_log (project_id, from_stage, to_stage, changed_by, duration_in_prev_seconds)
    VALUES (
      NEW.id, OLD.stage, NEW.stage, public.current_profile_id(),
      CASE WHEN prev_change_at IS NULL THEN NULL
           ELSE EXTRACT(EPOCH FROM (now() - prev_change_at))::int END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_log_project_stage ON public.projects;
CREATE TRIGGER tg_log_project_stage
  AFTER UPDATE OF stage ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_project_stage();

-- ── project_assignments (with Pillar 16 §D.3 freelancer_id + exclusive CHECK) ─

CREATE TABLE IF NOT EXISTS public.project_assignments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id            uuid REFERENCES public.profiles(id),
  freelancer_id         uuid REFERENCES public.freelancers(id),
  external_name         text,
  external_contact_info text,
  role                  project_assignment_role NOT NULL,
  rate_sar              numeric(10,2),
  rate_unit             text,
  assigned_at           timestamptz NOT NULL DEFAULT now(),
  start_date            text,
  end_date              text,
  notes                 text,
  created_by            uuid REFERENCES public.profiles(id),
  CONSTRAINT assignment_who_exclusive CHECK (
    (profile_id IS NOT NULL)::int +
    (freelancer_id IS NOT NULL)::int +
    (external_name IS NOT NULL)::int = 1
  )
);

CREATE INDEX IF NOT EXISTS pa_project_idx  ON public.project_assignments (project_id);
CREATE INDEX IF NOT EXISTS pa_profile_idx  ON public.project_assignments (profile_id);
CREATE INDEX IF NOT EXISTS pa_freelancer_idx ON public.project_assignments (freelancer_id);

-- ── project_contacts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id),
  side        text NOT NULL,                 -- 'brand' | 'agency' | 'vendor' | 'talent'
  role_label  text,
  is_primary  boolean NOT NULL DEFAULT false,
  notes       text,
  CONSTRAINT project_contact_unique UNIQUE (project_id, contact_id)
);

-- ── project_squad_assignments + squad explode trigger ────────────────────────

CREATE TABLE IF NOT EXISTS public.project_squad_assignments (
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  squad_id    uuid NOT NULL REFERENCES public.squads(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, squad_id)
);

CREATE OR REPLACE FUNCTION public.fn_explode_squad_assignment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  m record;
BEGIN
  FOR m IN
    SELECT profile_id, default_role
      FROM public.squad_members
     WHERE squad_id = NEW.squad_id
  LOOP
    IF m.default_role IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.project_assignments (project_id, profile_id, role)
    VALUES (NEW.project_id, m.profile_id, m.default_role::project_assignment_role)
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_explode_squad_assignment ON public.project_squad_assignments;
CREATE TRIGGER tg_explode_squad_assignment
  AFTER INSERT ON public.project_squad_assignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_explode_squad_assignment();

-- ── project_tasks + daily_tasks ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_task_id  uuid,
  title           text NOT NULL,
  description     text,
  assignee_id     uuid REFERENCES public.profiles(id),
  status          task_status NOT NULL DEFAULT 'pending',
  priority        task_priority NOT NULL DEFAULT 'normal',
  due_at          timestamptz,
  completed_at    timestamptz,
  depends_on      uuid[],
  position        integer NOT NULL DEFAULT 0,
  ai_suggested    boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_tasks
  ADD CONSTRAINT project_tasks_parent_fk
    FOREIGN KEY (parent_task_id) REFERENCES public.project_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pt_project_idx  ON public.project_tasks (project_id);
CREATE INDEX IF NOT EXISTS pt_assignee_idx ON public.project_tasks (assignee_id);
CREATE INDEX IF NOT EXISTS pt_status_idx   ON public.project_tasks (status);
CREATE INDEX IF NOT EXISTS pt_due_idx      ON public.project_tasks (due_at);

CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigner_id  uuid REFERENCES public.profiles(id),
  title        text NOT NULL,
  description  text,
  status       task_status NOT NULL DEFAULT 'pending',
  priority     task_priority NOT NULL DEFAULT 'normal',
  due_at       timestamptz,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dt_owner_idx ON public.daily_tasks (owner_id);
CREATE INDEX IF NOT EXISTS dt_due_idx   ON public.daily_tasks (due_at);

-- ── project_comments + self-FK ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_comments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_comment_id     uuid,
  author_id             uuid NOT NULL REFERENCES public.profiles(id),
  body                  text NOT NULL,
  mentioned_profile_ids uuid[],
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz,
  deleted_at            timestamptz
);

ALTER TABLE public.project_comments
  ADD CONSTRAINT project_comments_parent_fk
    FOREIGN KEY (parent_comment_id) REFERENCES public.project_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS pc_project_idx ON public.project_comments (project_id, created_at DESC);

-- ── project_pins ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_pins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pinned_type text NOT NULL,
  pinned_id   text,
  label       text,
  body        text,
  position    integer NOT NULL DEFAULT 0,
  pinned_by   uuid REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── project_templates ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name_ar     text NOT NULL,
  name_en     text,
  description text,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  use_count   integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── briefs ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.briefs (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                 uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version                    integer NOT NULL DEFAULT 1,
  received_at                timestamptz NOT NULL DEFAULT now(),
  received_via               text,
  source_email_message_id    text,
  source_text                text,
  parsed_summary             text,
  parsed_fields              jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsed_shoot_date          timestamptz,
  parsed_deliverables_count  integer,
  parsed_languages           text[],
  parsed_locations           text[],
  parsed_vehicles            text[],
  parsed_budget_sar          numeric(12,2),
  completeness_score         integer,
  missing_fields             text[],
  created_by                 uuid REFERENCES public.profiles(id),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brief_per_version UNIQUE (project_id, version)
);

-- ── deliverable_groups + deliverables ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.deliverable_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name_ar    text NOT NULL,
  name_en    text,
  kind       text,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliverables (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id                    uuid NOT NULL REFERENCES public.deliverable_groups(id) ON DELETE CASCADE,
  project_id                  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  position                    integer NOT NULL DEFAULT 0,
  item_number                 text,
  title                       text,
  status                      deliverable_status NOT NULL DEFAULT 'draft',

  current_version_url         text,
  current_version_number      integer NOT NULL DEFAULT 0,
  submitted_at                timestamptz,
  approved_at                 timestamptz,
  approved_by_id              uuid REFERENCES public.profiles(id),

  latest_client_note          text,
  latest_client_note_at       timestamptz,

  -- Pillar 16 §N.2
  requires_director_approval  boolean NOT NULL DEFAULT true,
  requires_am_approval        boolean NOT NULL DEFAULT true,
  current_approval_stage      text,
  current_cycle               integer NOT NULL DEFAULT 1,

  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deliverables_project_idx ON public.deliverables (project_id);
CREATE INDEX IF NOT EXISTS deliverables_group_idx   ON public.deliverables (group_id);
CREATE INDEX IF NOT EXISTS deliverables_status_idx  ON public.deliverables (status);

-- ── revision_rounds + revision_items ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.revision_rounds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  round_number      integer NOT NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  initiated_by_id   uuid REFERENCES public.profiles(id),
  summary           text,
  client_feedback   text,
  internal_notes    text,
  CONSTRAINT revision_round_unique UNIQUE (project_id, round_number)
);

CREATE TABLE IF NOT EXISTS public.revision_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        uuid NOT NULL REFERENCES public.revision_rounds(id) ON DELETE CASCADE,
  deliverable_id  uuid REFERENCES public.deliverables(id),
  item_number     text,
  change_request  text,
  status          text NOT NULL DEFAULT 'open',
  resolved_at     timestamptz,
  resolved_by_id  uuid REFERENCES public.profiles(id)
);

-- ── internal_approvals (Pillar 16 §N.1) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.internal_approvals (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id            uuid REFERENCES public.deliverables(id) ON DELETE CASCADE,
  stage                     internal_approval_stage NOT NULL,
  stage_order               integer NOT NULL,
  cycle_number              integer NOT NULL DEFAULT 1,
  reviewer_profile_id       uuid NOT NULL REFERENCES public.profiles(id),
  status                    internal_approval_status NOT NULL DEFAULT 'pending',
  submitted_at              timestamptz NOT NULL DEFAULT now(),
  reviewed_at               timestamptz,
  version_reviewed          integer,
  notes                     text,
  revision_request_text     text,
  revision_request_priority text,
  sla_hours                 integer,
  sla_breached_at           timestamptz,
  auto_advanced_by_id       uuid,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approvals_by_deliverable
  ON public.internal_approvals (deliverable_id, cycle_number, stage_order);
CREATE INDEX IF NOT EXISTS approvals_by_reviewer
  ON public.internal_approvals (reviewer_profile_id, status);

-- ── audit + updated_at on every Pillar 2 stage-2 table ───────────────────────

DO $$
DECLARE
  t text;
  has_updated_at boolean;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'projects','project_stages_log','project_assignments','project_contacts',
    'project_squad_assignments','project_tasks','daily_tasks',
    'project_comments','project_pins','project_templates',
    'briefs','deliverable_groups','deliverables',
    'revision_rounds','revision_items','internal_approvals'
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

-- ── RLS ──────────────────────────────────────────────────────────────────────

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'projects','project_stages_log','project_assignments','project_contacts',
    'project_squad_assignments','project_tasks','daily_tasks',
    'project_comments','project_pins','project_templates',
    'briefs','deliverable_groups','deliverables',
    'revision_rounds','revision_items','internal_approvals'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- Read: any authenticated user (refined per-role in Pillar 3).
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I; '
      || 'CREATE POLICY %I ON public.%I FOR SELECT '
      || 'USING (auth.role() = ''authenticated'' OR public.is_admin_caller());',
      t || '_read', t, t || '_read', t
    );

    -- Write: admin caller only for now (Pillar 3 will add per-role write).
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I; '
      || 'CREATE POLICY %I ON public.%I FOR ALL '
      || 'USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());',
      t || '_admin_write', t, t || '_admin_write', t
    );
  END LOOP;
END $$;

-- daily_tasks: self can read/write own
DROP POLICY IF EXISTS daily_tasks_self_read ON public.daily_tasks;
CREATE POLICY daily_tasks_self_read ON public.daily_tasks
  FOR SELECT USING (owner_id = public.current_profile_id() OR public.is_admin_caller());

DROP POLICY IF EXISTS daily_tasks_self_write ON public.daily_tasks;
CREATE POLICY daily_tasks_self_write ON public.daily_tasks
  FOR ALL USING (owner_id = public.current_profile_id())
  WITH CHECK (owner_id = public.current_profile_id());
