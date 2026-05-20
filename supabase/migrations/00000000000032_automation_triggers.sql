-- ════════════════════════════════════════════════════════════════════════════
-- Migration 32: Automation triggers + pg_cron jobs
--
-- This makes the system "wake up" without depending on the Trigger.dev worker:
--   • DB triggers write notifications and side-effects when events happen.
--   • pg_cron jobs compute KPI/health snapshots and fire alerts in pure SQL.
--
-- The existing Trigger.dev workers stay relevant for AI-heavy work
-- (daily-brief, insights-scanner), but the system is no longer asleep
-- while waiting for them.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Notify on project_assignment INSERT ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_on_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_project   record;
BEGIN
  -- Only notify when an internal team member is the assignee.
  IF NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, code, title, title_ar
    INTO v_project
    FROM public.projects
    WHERE id = NEW.project_id;

  INSERT INTO public.notifications (
    recipient_id, event_type_key, entity_type, entity_id,
    title, body, link_url, channels_requested
  ) VALUES (
    NEW.profile_id,
    'project.assigned',
    'project',
    NEW.project_id,
    'تم تعيينك على مشروع',
    COALESCE(v_project.code, '?') || ' · ' ||
      COALESCE(v_project.title_ar, v_project.title, '?') ||
      ' — كـ ' || NEW.role::text,
    '/projects/' || NEW.project_id::text,
    ARRAY['in_app']::text[]
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_assignment ON public.project_assignments;
CREATE TRIGGER trg_notify_on_assignment
AFTER INSERT ON public.project_assignments
FOR EACH ROW EXECUTE FUNCTION public.fn_notify_on_assignment();


-- ── 2. Notify mentioned profiles in project_comments ──────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_on_mention()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_recipient uuid;
  v_project   record;
  v_author    text;
BEGIN
  IF NEW.mentioned_profile_ids IS NULL OR array_length(NEW.mentioned_profile_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT code, title_ar, title INTO v_project
    FROM public.projects WHERE id = NEW.project_id;
  SELECT display_name INTO v_author
    FROM public.profiles WHERE id = NEW.author_id;

  FOREACH v_recipient IN ARRAY NEW.mentioned_profile_ids LOOP
    IF v_recipient = NEW.author_id THEN
      CONTINUE; -- don't ping the author about their own comment
    END IF;
    INSERT INTO public.notifications (
      recipient_id, event_type_key, entity_type, entity_id,
      title, body, link_url, channels_requested
    ) VALUES (
      v_recipient,
      'mention.in_comment',
      'project',
      NEW.project_id,
      COALESCE(v_author, 'أحدهم') || ' منشنك',
      COALESCE(v_project.code, '?') || ' — ' ||
        substring(NEW.body for 120),
      '/projects/' || NEW.project_id::text,
      ARRAY['in_app']::text[]
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_mention ON public.project_comments;
CREATE TRIGGER trg_notify_on_mention
AFTER INSERT ON public.project_comments
FOR EACH ROW EXECUTE FUNCTION public.fn_notify_on_mention();


-- ── 3. Notify on project stage change to terminal stages ──────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_on_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_recipient uuid;
  v_recipients uuid[];
BEGIN
  IF OLD.stage = NEW.stage THEN
    RETURN NEW;
  END IF;

  -- Collect PM + AM + Production manager (distinct, non-null)
  v_recipients := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[
      NEW.project_manager_id,
      NEW.account_manager_id,
      NEW.production_manager_id
    ]) x WHERE x IS NOT NULL
  );

  IF array_length(v_recipients, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_recipient IN ARRAY v_recipients LOOP
    INSERT INTO public.notifications (
      recipient_id, event_type_key, entity_type, entity_id,
      title, body, link_url, channels_requested
    ) VALUES (
      v_recipient,
      'project.stage_changed',
      'project',
      NEW.id,
      NEW.code || ' انتقل إلى ' || NEW.stage::text,
      COALESCE(NEW.title_ar, NEW.title) || ' — من ' ||
        OLD.stage::text || ' إلى ' || NEW.stage::text,
      '/projects/' || NEW.id::text,
      ARRAY['in_app']::text[]
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_stage_change ON public.projects;
CREATE TRIGGER trg_notify_on_stage_change
AFTER UPDATE OF stage ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.fn_notify_on_stage_change();


-- ── 4. Notify creator when deliverable goes back to revisions ─────────────
-- Also auto-create a follow-up task on the project so it doesn't get lost.
CREATE OR REPLACE FUNCTION public.fn_react_to_deliverable_revisions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_project   record;
  v_pm_id     uuid;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('revisions_director','revisions_am','revisions_client') THEN
    RETURN NEW;
  END IF;

  SELECT id, code, title, title_ar, project_manager_id
    INTO v_project
    FROM public.projects
    WHERE id = NEW.project_id;
  v_pm_id := v_project.project_manager_id;

  IF v_pm_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, event_type_key, entity_type, entity_id,
      title, body, link_url, channels_requested
    ) VALUES (
      v_pm_id,
      'deliverable.revisions_back_to_creator',
      'deliverable',
      NEW.id,
      'مطلوب تعديلات على ' || COALESCE(NEW.item_number, '?'),
      v_project.code || ' · ' ||
        COALESCE(v_project.title_ar, v_project.title) || ' — ' ||
        NEW.status::text,
      '/projects/' || NEW.project_id::text,
      ARRAY['in_app']::text[]
    );

    -- Auto-create a task so the revisions are tracked.
    INSERT INTO public.project_tasks (
      project_id, title, description, status, priority,
      assignee_id, ai_suggested
    ) VALUES (
      NEW.project_id,
      'تنفيذ تعديلات: ' || COALESCE(NEW.title, NEW.item_number, 'deliverable'),
      COALESCE(NEW.latest_client_note, 'طلب تعديلات'),
      'pending'::task_status,
      'high'::task_priority,
      v_pm_id,
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_react_to_deliverable_revisions ON public.deliverables;
CREATE TRIGGER trg_react_to_deliverable_revisions
AFTER UPDATE OF status ON public.deliverables
FOR EACH ROW EXECUTE FUNCTION public.fn_react_to_deliverable_revisions();


-- ── 5. Notify on deliverable submitted for review ─────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_on_deliverable_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_project record;
  v_target  uuid;
  v_key     text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('pending_director', 'pending_am', 'client_ready') THEN
    RETURN NEW;
  END IF;

  SELECT id, code, title, title_ar,
         project_manager_id, account_manager_id, production_manager_id
    INTO v_project
    FROM public.projects WHERE id = NEW.project_id;

  IF NEW.status = 'pending_director' THEN
    -- Director ≈ production_manager (Mohammed's setup); fall back to PM.
    v_target := COALESCE(v_project.production_manager_id, v_project.project_manager_id);
    v_key := 'deliverable.submitted_for_director';
  ELSIF NEW.status = 'pending_am' THEN
    v_target := v_project.account_manager_id;
    v_key := 'deliverable.approved_by_director';
  ELSE
    -- client_ready
    v_target := v_project.account_manager_id;
    v_key := 'deliverable.client_ready';
  END IF;

  IF v_target IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, event_type_key, entity_type, entity_id,
      title, body, link_url, channels_requested
    ) VALUES (
      v_target, v_key, 'deliverable', NEW.id,
      'بانتظار مراجعتك: ' || COALESCE(NEW.item_number, NEW.title, '?'),
      v_project.code || ' · ' || COALESCE(v_project.title_ar, v_project.title),
      '/projects/' || NEW.project_id::text,
      ARRAY['in_app']::text[]
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_deliverable_review ON public.deliverables;
CREATE TRIGGER trg_notify_on_deliverable_review
AFTER UPDATE OF status ON public.deliverables
FOR EACH ROW EXECUTE FUNCTION public.fn_notify_on_deliverable_review();


-- ══════════════════════════════════════════════════════════════════════════
-- pg_cron jobs (SQL-only — don't need the worker)
-- ══════════════════════════════════════════════════════════════════════════

-- KPI snapshot: company-wide totals every hour
CREATE OR REPLACE FUNCTION public.fn_compute_kpi_snapshots()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_today text := to_char(now(), 'YYYY-MM-DD');
  v_period_start text := to_char(date_trunc('month', now()), 'YYYY-MM-DD');
BEGIN
  -- active_projects: company scope
  INSERT INTO public.kpi_snapshots (kpi_key, scope_entity_type, scope_entity_id, period_start, period_end, value)
  SELECT 'active_projects_count', NULL, NULL, v_today, v_today,
         count(*)::numeric
    FROM public.projects
    WHERE archived_at IS NULL
      AND stage NOT IN ('delivered','archived','lost','cancelled')
  ON CONFLICT (kpi_key, scope_entity_type, scope_entity_id, period_start)
    DO UPDATE SET value = EXCLUDED.value, computed_at = now();

  -- delivered_value_mtd: month-to-date delivered revenue
  INSERT INTO public.kpi_snapshots (kpi_key, scope_entity_type, scope_entity_id, period_start, period_end, value)
  SELECT 'delivered_value_mtd', NULL, NULL, v_period_start, v_today,
         COALESCE(SUM(contracted_value_sar), 0)::numeric
    FROM public.projects
    WHERE delivered_at >= date_trunc('month', now())
  ON CONFLICT (kpi_key, scope_entity_type, scope_entity_id, period_start)
    DO UPDATE SET value = EXCLUDED.value, computed_at = now();

  -- equipment_utilization_pct: checked_out / total active
  INSERT INTO public.kpi_snapshots (kpi_key, scope_entity_type, scope_entity_id, period_start, period_end, value)
  SELECT 'equipment_utilization_pct', NULL, NULL, v_today, v_today,
         CASE WHEN count(*) = 0 THEN 0
              ELSE (count(*) FILTER (WHERE status = 'checked_out')::numeric
                    / count(*)::numeric)
         END
    FROM public.equipment
    WHERE archived_at IS NULL
  ON CONFLICT (kpi_key, scope_entity_type, scope_entity_id, period_start)
    DO UPDATE SET value = EXCLUDED.value, computed_at = now();

  -- open_leads_count
  INSERT INTO public.kpi_snapshots (kpi_key, scope_entity_type, scope_entity_id, period_start, period_end, value)
  SELECT 'open_leads_count', NULL, NULL, v_today, v_today, count(*)::numeric
    FROM public.leads
    WHERE status IN ('new','qualified','nurturing')
  ON CONFLICT (kpi_key, scope_entity_type, scope_entity_id, period_start)
    DO UPDATE SET value = EXCLUDED.value, computed_at = now();
END;
$$;

-- Ensure the KPI definitions referenced above exist (idempotent).
INSERT INTO public.kpi_definitions (key, name_ar, name_en, scope, unit, refresh_frequency)
VALUES
  ('active_projects_count',       'مشاريع نشطة',                   'Active projects',          'company', 'count',  'hourly'),
  ('delivered_value_mtd',         'إيراد الشهر حتى الآن',           'Delivered value MTD',      'company', 'sar',    'hourly'),
  ('equipment_utilization_pct',   'نسبة توظيف المعدات',             'Equipment utilization %',  'company', 'pct',    'hourly'),
  ('open_leads_count',            'فرص مفتوحة',                    'Open leads',               'company', 'count',  'hourly')
ON CONFLICT (key) DO NOTHING;


-- Client health snapshot: nightly
CREATE OR REPLACE FUNCTION public.fn_compute_client_health()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_today text := to_char(now(), 'YYYY-MM-DD');
BEGIN
  INSERT INTO public.client_health_snapshots (
    client_id, snapshot_date,
    total_revenue_sar, total_projects_count, active_projects_count,
    lost_projects_count, last_project_at, days_since_last_project
  )
  SELECT
    c.id,
    v_today,
    COALESCE(SUM(p.contracted_value_sar) FILTER (WHERE p.delivered_at IS NOT NULL), 0)::numeric,
    count(p.id)::int,
    count(p.id) FILTER (WHERE p.stage NOT IN ('delivered','archived','lost','cancelled'))::int,
    count(p.id) FILTER (WHERE p.stage = 'lost')::int,
    MAX(p.created_at),
    EXTRACT(EPOCH FROM (now() - MAX(p.created_at)))::int / 86400
  FROM public.clients c
  LEFT JOIN public.projects p ON p.client_id = c.id
  WHERE c.archived_at IS NULL
  GROUP BY c.id
  ON CONFLICT (client_id, snapshot_date) DO UPDATE SET
    total_revenue_sar = EXCLUDED.total_revenue_sar,
    total_projects_count = EXCLUDED.total_projects_count,
    active_projects_count = EXCLUDED.active_projects_count,
    lost_projects_count = EXCLUDED.lost_projects_count,
    last_project_at = EXCLUDED.last_project_at,
    days_since_last_project = EXCLUDED.days_since_last_project,
    computed_at = now();
END;
$$;


-- Lead temperature decay: leads that haven't been touched in a while cool off.
CREATE OR REPLACE FUNCTION public.fn_decay_lead_temperature()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.leads
  SET temperature_score = GREATEST(0,
        COALESCE(temperature_score, 50) -
        LEAST(20, EXTRACT(EPOCH FROM (now() - updated_at))::int / 86400)
      ),
      updated_at = updated_at  -- preserve updated_at (no churn)
  WHERE status IN ('new','qualified','nurturing')
    AND updated_at < now() - interval '24 hours';
END;
$$;


-- Equipment battery alerts: anything that requires_charging and hasn't
-- charged in >30 days fires once into alert_fires (cooldown handled by
-- the existing key uniqueness pattern — re-firing is allowed after 24h).
CREATE OR REPLACE FUNCTION public.fn_scan_battery_alerts()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT e.id, e.code,
           EXTRACT(EPOCH FROM (now() - COALESCE(e.last_charged_at, '1970-01-01'::timestamptz)))::int / 86400 AS days_since
      FROM public.equipment e
      WHERE e.requires_charging = true
        AND e.archived_at IS NULL
        AND (e.last_charged_at IS NULL OR e.last_charged_at < now() - interval '30 days')
        AND NOT EXISTS (
          SELECT 1 FROM public.alert_fires af
          WHERE af.entity_type = 'equipment'
            AND af.entity_id = e.id
            AND af.fired_at > now() - interval '24 hours'
        )
  LOOP
    INSERT INTO public.alert_fires (
      rule_key, entity_type, entity_id, metadata
    ) VALUES (
      'equipment_battery_low',
      'equipment',
      r.id,
      jsonb_build_object('code', r.code, 'days_since', r.days_since)
    );
  END LOOP;
END;
$$;

-- Ensure rule exists.
INSERT INTO public.alert_rules (
  key, name_ar, name_en, description,
  trigger_type, trigger_spec, notification_event_key, recipient_strategy,
  cooldown_minutes, active
) VALUES (
  'equipment_battery_low',
  'بطارية تحتاج شحن',
  'Equipment battery needs charging',
  'معدّة تحتاج شحن ولم تُشحَن منذ أكثر من 30 يوم',
  'schedule',
  '{"handler":"equipment_battery_low"}'::jsonb,
  'equipment.charging_needed',
  'production_team',
  1440,
  true
)
ON CONFLICT (key) DO NOTHING;


-- Stage-stuck alerts: projects sitting in `brief` for >3 days, or `quoted`
-- for >5 days. Fires into alert_fires + notifies PM/AM directly.
CREATE OR REPLACE FUNCTION public.fn_scan_stage_stuck_alerts()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r record;
  v_recipient uuid;
BEGIN
  FOR r IN
    SELECT p.id, p.code, p.title_ar, p.title, p.stage,
           p.project_manager_id, p.account_manager_id,
           EXTRACT(EPOCH FROM (now() - p.updated_at))::int / 86400 AS days_stuck
      FROM public.projects p
      WHERE p.archived_at IS NULL
        AND (
          (p.stage = 'brief' AND p.updated_at < now() - interval '3 days') OR
          (p.stage = 'quoted' AND p.updated_at < now() - interval '5 days') OR
          (p.stage = 'editing' AND p.updated_at < now() - interval '7 days')
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.alert_fires af
          WHERE af.entity_type = 'project'
            AND af.entity_id = p.id
            AND af.rule_key = 'project_stage_stuck'
            AND af.fired_at > now() - interval '24 hours'
        )
  LOOP
    INSERT INTO public.alert_fires (
      rule_key, entity_type, entity_id, metadata
    ) VALUES (
      'project_stage_stuck',
      'project',
      r.id,
      jsonb_build_object('code', r.code, 'stage', r.stage, 'days_stuck', r.days_stuck)
    );

    FOREACH v_recipient IN ARRAY ARRAY[r.project_manager_id, r.account_manager_id] LOOP
      IF v_recipient IS NOT NULL THEN
        INSERT INTO public.notifications (
          recipient_id, event_type_key, entity_type, entity_id,
          title, body, link_url, channels_requested
        ) VALUES (
          v_recipient,
          'project.stage_changed',
          'project',
          r.id,
          'مشروع متوقف في ' || r.stage::text,
          r.code || ' · ' || COALESCE(r.title_ar, r.title) ||
            ' — ' || r.days_stuck::text || ' يوم بدون تحديث',
          '/projects/' || r.id::text,
          ARRAY['in_app']::text[]
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

INSERT INTO public.alert_rules (
  key, name_ar, name_en, description,
  trigger_type, trigger_spec, notification_event_key, recipient_strategy,
  cooldown_minutes, active
) VALUES (
  'project_stage_stuck',
  'مشروع متوقف في مرحلة',
  'Project stuck in stage',
  'مشروع لم يتحرك من مرحلته الحالية في المدة المعتادة',
  'schedule',
  '{"handler":"project_brief_stuck"}'::jsonb,
  'project.stage_changed',
  'pm_and_am',
  1440,
  true
)
ON CONFLICT (key) DO NOTHING;


-- ── Schedule the cron jobs ────────────────────────────────────────────────
-- Note: pg_cron extension must already be enabled (it is — Pillar 1).
-- Idempotent unschedule-then-schedule pattern.

DO $$
DECLARE jid bigint;
BEGIN
  -- KPI snapshots every hour
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'antagna_kpi_snapshots' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
  PERFORM cron.schedule('antagna_kpi_snapshots', '0 * * * *',
    $cron$ SELECT public.fn_compute_kpi_snapshots(); $cron$);

  -- Client health snapshot nightly at 02:00 UTC (05:00 Riyadh)
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'antagna_client_health' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
  PERFORM cron.schedule('antagna_client_health', '0 2 * * *',
    $cron$ SELECT public.fn_compute_client_health(); $cron$);

  -- Lead decay every 6 hours
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'antagna_lead_decay' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
  PERFORM cron.schedule('antagna_lead_decay', '15 */6 * * *',
    $cron$ SELECT public.fn_decay_lead_temperature(); $cron$);

  -- Battery alerts hourly
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'antagna_battery_alerts' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
  PERFORM cron.schedule('antagna_battery_alerts', '30 * * * *',
    $cron$ SELECT public.fn_scan_battery_alerts(); $cron$);

  -- Stage-stuck alerts every 4 hours
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'antagna_stage_stuck' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
  PERFORM cron.schedule('antagna_stage_stuck', '45 */4 * * *',
    $cron$ SELECT public.fn_scan_stage_stuck_alerts(); $cron$);
END $$;
