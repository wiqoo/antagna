-- Pillar 5 — Project lifecycle: tables, state machine enforcement, auto-deliver,
-- stage-entry tasks, template instantiation, share-token portal RPC.

-- ── tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stage_task_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage               project_stage NOT NULL,
  title_ar            text NOT NULL,
  title_en            text,
  description         text,
  assignee_role_hint  project_assignment_role,
  due_offset_days     integer,
  is_mandatory        boolean NOT NULL DEFAULT false,
  position            integer NOT NULL DEFAULT 0,
  active              boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS stt_stage_idx ON public.stage_task_templates (stage) WHERE active = true;

CREATE TABLE IF NOT EXISTS public.project_recurrence_rules (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_project_id  uuid NOT NULL REFERENCES public.projects(id),
  rrule                text NOT NULL,
  next_occurrence_at   timestamptz,
  last_spawned_at      timestamptz,
  active               boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS prr_next_occurrence_idx
  ON public.project_recurrence_rules (next_occurrence_at)
  WHERE active = true AND next_occurrence_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.project_share_views (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  share_token     uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  audience_label  text,
  show_sections   text[] NOT NULL DEFAULT ARRAY['overview','deliverables']::text[],
  expires_at      timestamptz,
  revoked_at      timestamptz,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS psv_project_idx ON public.project_share_views (project_id);
CREATE INDEX IF NOT EXISTS psv_token_idx   ON public.project_share_views (share_token) WHERE revoked_at IS NULL;

-- ── §4 state-machine enforcement on projects.stage ────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_check_project_stage_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF OLD.stage = NEW.stage THEN RETURN NEW; END IF;

  -- Admin bypass (system_admin / system_manager via is_admin_caller()).
  IF public.is_admin_caller() THEN RETURN NEW; END IF;

  v_allowed := CASE
    WHEN OLD.stage = 'lead'      AND NEW.stage IN ('brief','lost')                              THEN true
    WHEN OLD.stage = 'brief'     AND NEW.stage IN ('quoted','lost','cancelled')                 THEN true
    WHEN OLD.stage = 'quoted'    AND NEW.stage IN ('approved','lost','cancelled')               THEN true
    WHEN OLD.stage = 'approved'  AND NEW.stage IN ('planning','cancelled')                      THEN true
    WHEN OLD.stage = 'planning'  AND NEW.stage IN ('shooting','cancelled')                      THEN true
    WHEN OLD.stage = 'shooting'  AND NEW.stage IN ('editing','cancelled')                       THEN true
    WHEN OLD.stage = 'editing'   AND NEW.stage IN ('review','shooting')                         THEN true
    WHEN OLD.stage = 'review'    AND NEW.stage IN ('delivered','editing')                       THEN true
    WHEN OLD.stage = 'delivered' AND NEW.stage IN ('archived')                                  THEN true
    WHEN OLD.stage = 'lost'      AND NEW.stage IN ('brief')                                     THEN true
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid project stage transition: % -> %', OLD.stage, NEW.stage
      USING HINT = 'Use admin override or correct the prior stage';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_check_project_stage ON public.projects;
CREATE TRIGGER tg_check_project_stage
  BEFORE UPDATE OF stage ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_project_stage_transition();

-- ── §5 auto-deliver: when all deliverables of a project are 'delivered',
--     advance the project to 'delivered'.

CREATE OR REPLACE FUNCTION public.fn_check_project_auto_deliver()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_total int;
  v_delivered int;
  v_project_stage project_stage;
BEGIN
  IF NEW.status <> 'delivered' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_total     FROM public.deliverables WHERE project_id = NEW.project_id;
  SELECT COUNT(*) INTO v_delivered FROM public.deliverables WHERE project_id = NEW.project_id AND status = 'delivered';

  IF v_total > 0 AND v_total = v_delivered THEN
    SELECT stage INTO v_project_stage FROM public.projects WHERE id = NEW.project_id;
    IF v_project_stage = 'review' THEN
      UPDATE public.projects
        SET stage = 'delivered', delivered_at = now()
        WHERE id = NEW.project_id;

      INSERT INTO public.activity_events
        (entity_type, entity_id, project_id, action, summary_ar, summary_en, metadata)
      VALUES
        ('project', NEW.project_id, NEW.project_id, 'auto_advanced',
         'تم تسليم كل المخرجات، المشروع انتقل لحالة "تم التسليم"',
         'All deliverables completed; project moved to delivered',
         jsonb_build_object('auto', true));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_auto_deliver ON public.deliverables;
CREATE TRIGGER tg_auto_deliver
  AFTER UPDATE OF status ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_project_auto_deliver();

-- ── §6 stage-entry hook: spawn canonical tasks when a project enters a stage ─

CREATE OR REPLACE FUNCTION public.fn_spawn_stage_tasks()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.project_tasks
      (project_id, title, description, status, position, ai_suggested, due_at)
    SELECT
      NEW.id,
      stt.title_ar,
      stt.description,
      'pending'::task_status,
      stt.position,
      false,
      CASE WHEN stt.due_offset_days IS NULL THEN NULL
           ELSE now() + (stt.due_offset_days || ' days')::interval END
    FROM public.stage_task_templates stt
    WHERE stt.stage = NEW.stage AND stt.active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_spawn_stage_tasks ON public.projects;
CREATE TRIGGER tg_spawn_stage_tasks
  AFTER UPDATE OF stage ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_spawn_stage_tasks();

-- ── §7 create-from-template ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_create_project_from_template(
  p_template_id uuid,
  p_client_id   uuid,
  p_title       text,
  p_project_type project_type DEFAULT 'shoot'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_payload jsonb;
  v_dg_id uuid;
  v_dg record;
  v_tk jsonb;
BEGIN
  SELECT payload INTO v_payload FROM public.project_templates WHERE id = p_template_id AND active = true;
  IF v_payload IS NULL THEN
    RAISE EXCEPTION 'project_template % not found / inactive', p_template_id;
  END IF;

  INSERT INTO public.projects (title, project_type, client_id, stage, created_by)
  VALUES (p_title, p_project_type, p_client_id, 'brief', public.current_profile_id())
  RETURNING id INTO v_project_id;

  -- Apply payload.default_deliverable_groups if present.
  IF v_payload ? 'default_deliverable_groups' THEN
    FOR v_dg IN SELECT * FROM jsonb_to_recordset(v_payload->'default_deliverable_groups')
                  AS x(name_ar text, name_en text, kind text)
    LOOP
      INSERT INTO public.deliverable_groups (project_id, name_ar, name_en, kind)
      VALUES (v_project_id, v_dg.name_ar, v_dg.name_en, v_dg.kind);
    END LOOP;
  END IF;

  -- Apply payload.default_tasks if present (project-level seed; stage-entry hook adds more).
  IF v_payload ? 'default_tasks' THEN
    FOR v_tk IN SELECT * FROM jsonb_array_elements(v_payload->'default_tasks')
    LOOP
      INSERT INTO public.project_tasks (project_id, title, description, status, ai_suggested)
      VALUES (
        v_project_id,
        v_tk->>'title',
        v_tk->>'description',
        'pending'::task_status,
        false
      );
    END LOOP;
  END IF;

  -- Bump template use_count.
  UPDATE public.project_templates SET use_count = use_count + 1 WHERE id = p_template_id;

  RETURN v_project_id;
END;
$$;

-- ── §8 portal RPC: SECURITY DEFINER read of redacted project by share_token ──

CREATE OR REPLACE FUNCTION public.fn_get_shared_project(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_view record;
  v_project record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_view
  FROM public.project_share_views
  WHERE share_token = p_token
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_view IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_or_expired_token');
  END IF;

  SELECT id, code, title, title_ar, description, stage, project_type,
         shoot_starts_at, shoot_ends_at, delivery_due_at, delivered_at
  INTO v_project
  FROM public.projects WHERE id = v_view.project_id LIMIT 1;

  IF v_project IS NULL THEN
    RETURN jsonb_build_object('error', 'project_not_found');
  END IF;

  v_result := jsonb_build_object(
    'project', jsonb_build_object(
      'id',                v_project.id,
      'code',              v_project.code,
      'title',             v_project.title,
      'title_ar',          v_project.title_ar,
      'description',       v_project.description,
      'stage',             v_project.stage,
      'project_type',      v_project.project_type,
      'shoot_starts_at',   v_project.shoot_starts_at,
      'shoot_ends_at',     v_project.shoot_ends_at,
      'delivery_due_at',   v_project.delivery_due_at,
      'delivered_at',      v_project.delivered_at
    ),
    'audience_label',  v_view.audience_label,
    'show_sections',   v_view.show_sections,
    'expires_at',      v_view.expires_at
  );

  -- Deliverables (if requested).
  IF 'deliverables' = ANY(v_view.show_sections) THEN
    v_result := v_result || jsonb_build_object(
      'deliverables', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id',                   d.id,
          'group_id',             d.group_id,
          'item_number',          d.item_number,
          'title',                d.title,
          'status',               d.status,
          'current_version_url',  d.current_version_url,
          'current_version_number', d.current_version_number,
          'latest_client_note',   d.latest_client_note,
          'latest_client_note_at', d.latest_client_note_at,
          'updated_at',           d.updated_at
        ) ORDER BY d.position, d.created_at), '[]'::jsonb)
        FROM public.deliverables d
        WHERE d.project_id = v_project.id
      ),
      'deliverable_groups', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id',       g.id,
          'name_ar',  g.name_ar,
          'name_en',  g.name_en,
          'kind',     g.kind,
          'position', g.position
        ) ORDER BY g.position), '[]'::jsonb)
        FROM public.deliverable_groups g
        WHERE g.project_id = v_project.id
      )
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute on the portal RPC to anon (this is the only way unauthed
-- visitors can read project data).
GRANT EXECUTE ON FUNCTION public.fn_get_shared_project(uuid) TO anon, authenticated, service_role;

-- ── audit + updated_at + RLS on the 3 new tables ─────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['stage_task_templates','project_recurrence_rules','project_share_views'])
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
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I; '
      || 'CREATE POLICY %I ON public.%I FOR ALL '
      || 'USING (public.is_admin_caller() OR public.current_user_has_permission(''project.update_any'')) '
      || 'WITH CHECK (public.is_admin_caller() OR public.current_user_has_permission(''project.update_any''));',
      t || '_write', t, t || '_write', t
    );
  END LOOP;
END $$;
