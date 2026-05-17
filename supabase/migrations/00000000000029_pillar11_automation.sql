-- Pillar 11 — Automation & Alerts Engine: declarative rules + fires audit + seed.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_rule_trigger_type') THEN
    CREATE TYPE alert_rule_trigger_type AS ENUM ('schedule','event','threshold');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                     text NOT NULL UNIQUE,
  name_ar                 text NOT NULL,
  name_en                 text,
  description             text,
  trigger_type            alert_rule_trigger_type NOT NULL,
  trigger_spec            jsonb NOT NULL,
  notification_event_key  text REFERENCES public.notification_event_types(key),
  recipient_strategy      text NOT NULL,
  escalation_chain        jsonb,
  auto_action             jsonb,
  cooldown_minutes        integer NOT NULL DEFAULT 60,
  active                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ar_active_trigger_idx ON public.alert_rules (trigger_type) WHERE active = true;

CREATE TABLE IF NOT EXISTS public.alert_fires (
  id                    bigserial PRIMARY KEY,
  rule_key              text NOT NULL REFERENCES public.alert_rules(key),
  entity_type           text NOT NULL,
  entity_id             uuid NOT NULL,
  notified_profile_ids  uuid[],
  escalation_step       integer NOT NULL DEFAULT 0,
  acknowledged_at       timestamptz,
  acknowledged_by_id    uuid REFERENCES public.profiles(id),
  snoozed_until         timestamptz,
  auto_action_taken     text,
  auto_action_ref_id    uuid,
  metadata              jsonb,
  fired_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fires_by_entity ON public.alert_fires (entity_type, entity_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS fires_by_rule   ON public.alert_fires (rule_key, fired_at DESC);
CREATE INDEX IF NOT EXISTS fires_unack_idx ON public.alert_fires (rule_key) WHERE acknowledged_at IS NULL;

-- ── seed initial rules ───────────────────────────────────────────────────────

INSERT INTO public.alert_rules (key, name_ar, name_en, trigger_type, trigger_spec, recipient_strategy, escalation_chain, auto_action) VALUES
  ('invoice_overdue_30d',
   'فاتورة متأخرة 30 يوم', 'Invoice overdue 30d',
   'schedule',
   jsonb_build_object('cron','0 9 * * *','query','SELECT id FROM invoices WHERE status=''issued'' AND due_at < now() - interval ''30 days'''),
   'am',
   jsonb_build_array(
     jsonb_build_object('afterMinutes', 0, 'recipientStrategy', 'am'),
     jsonb_build_object('afterMinutes', 4320, 'recipientStrategy', 'pm'),
     jsonb_build_object('afterMinutes', 10080, 'recipientStrategy', 'admin')
   ),
   jsonb_build_object('type','draft_email','templateKey','chase_30d','requiresApproval', true)
  ),
  ('project_stalled_7d',
   'مشروع متوقف 7 أيام', 'Project stalled 7d',
   'schedule',
   jsonb_build_object('cron','0 9 * * *','query','SELECT id FROM projects WHERE stage NOT IN (''delivered'',''archived'',''lost'',''cancelled'') AND updated_at < now() - interval ''7 days'''),
   'pm',
   jsonb_build_array(
     jsonb_build_object('afterMinutes', 0,    'recipientStrategy', 'pm'),
     jsonb_build_object('afterMinutes', 2880, 'recipientStrategy', 'admin')
   ),
   NULL
  ),
  ('project_no_client_reply_5d',
   'العميل لم يرد منذ 5 أيام', 'No client reply 5d',
   'schedule',
   jsonb_build_object('cron','0 9 * * *','query','SELECT et.project_id AS id FROM email_threads et WHERE et.project_id IS NOT NULL AND et.status=''open'' AND COALESCE(et.last_inbound_at, et.last_message_at) < now() - interval ''5 days'''),
   'am',
   jsonb_build_array(jsonb_build_object('afterMinutes', 2880, 'recipientStrategy', 'pm')),
   jsonb_build_object('type','draft_email','templateKey','acknowledgement_en','requiresApproval', true)
  ),
  ('battery_stale_30d',
   'بطارية بدون شحن 30 يوم', 'Battery stale 30d',
   'schedule',
   jsonb_build_object('cron','0 9 * * *','query','SELECT id FROM equipment WHERE requires_charging=true AND status=''available'' AND (last_charged_at IS NULL OR last_charged_at < now() - interval ''30 days'')'),
   'capability:equipment_manager',
   jsonb_build_array(jsonb_build_object('afterMinutes', 4320, 'recipientStrategy', 'admin')),
   NULL
  ),
  ('battery_never_charged',
   'بطارية لم تُشحن قط', 'Battery never charged',
   'schedule',
   jsonb_build_object('cron','0 9 * * *','query','SELECT id FROM equipment WHERE requires_charging=true AND last_charged_at IS NULL'),
   'capability:equipment_manager',
   NULL, NULL
  ),
  ('equipment_repair_unreturned_30d',
   'معدّة في الصيانة منذ 30 يوم', 'Equipment repair unreturned 30d',
   'schedule',
   jsonb_build_object('cron','0 9 * * *','query','SELECT id FROM equipment_repairs WHERE status IN (''sent'',''in_repair'') AND reported_at < now() - interval ''30 days'''),
   'capability:equipment_manager',
   NULL, NULL
  ),
  ('quote_expiring_3d',
   'عرض سعر قارب على الانتهاء', 'Quote expiring 3d',
   'schedule',
   jsonb_build_object('cron','0 9 * * *','query','SELECT id FROM quotes WHERE status=''sent'' AND valid_until_at BETWEEN now() AND now() + interval ''3 days'''),
   'am', NULL, NULL
  ),
  ('lead_no_followup_3d',
   'lead بدون متابعة 3 أيام', 'Lead no follow-up 3d',
   'schedule',
   jsonb_build_object('cron','0 9 * * *','query','SELECT id FROM leads WHERE status IN (''new'',''qualified'',''nurturing'') AND received_at < now() - interval ''3 days'''),
   'assignee',
   jsonb_build_array(jsonb_build_object('afterMinutes', 1440, 'recipientStrategy', 'pm')),
   jsonb_build_object('type','draft_email','templateKey','acknowledgement_en','requiresApproval', true)
  ),
  ('lead_ghosted_14d',
   'lead مهجور 14 يوم', 'Lead ghosted 14d',
   'schedule',
   jsonb_build_object('cron','0 9 * * *','query','SELECT id FROM leads WHERE status IN (''new'',''qualified'',''nurturing'') AND received_at < now() - interval ''14 days'''),
   'assignee',
   NULL,
   jsonb_build_object('type','update_status','table','leads','setStatus','ghosted')
  ),
  ('shoot_starts_in_24h_unconfirmed',
   'تصوير خلال 24 ساعة بدون تأكيد', 'Shoot in 24h unconfirmed',
   'schedule',
   jsonb_build_object('cron','0 * * * *','query','SELECT id FROM projects WHERE shoot_starts_at BETWEEN now() AND now() + interval ''24 hours'' AND stage IN (''approved'',''planning'')'),
   'pm',
   jsonb_build_array(jsonb_build_object('afterMinutes', 360, 'recipientStrategy', 'admin')),
   NULL
  ),
  ('client_health_drop',
   'تراجع صحة العميل (avg payment > 90)', 'Client health drop',
   'threshold',
   jsonb_build_object('metricKey','avg_payment_days','op','>','value',90),
   'am',
   jsonb_build_array(jsonb_build_object('afterMinutes', 1440, 'recipientStrategy', 'admin')),
   NULL
  ),
  ('client_first_email_response_due',
   'الرد على إيميل عميل خلال 4 ساعات', 'Client first reply due (4h)',
   'schedule',
   jsonb_build_object('cron','0 * * * *','query','SELECT id FROM email_threads WHERE status=''open'' AND last_inbound_at IS NOT NULL AND last_outbound_at IS NULL AND last_inbound_at < now() - interval ''4 hours'''),
   'assignee',
   jsonb_build_array(jsonb_build_object('afterMinutes', 240, 'recipientStrategy', 'pm')),
   jsonb_build_object('type','draft_email','templateKey','acknowledgement_en','requiresApproval', true)
  )
ON CONFLICT (key) DO NOTHING;

-- ── pg_cron tick to call the worker scanner every 5 minutes ──────────────────
-- The actual scan logic runs in apps/worker (Trigger.dev task). pg_cron just
-- writes a heartbeat row to let us verify the schedule is live. Pillar 13 wires
-- the listener that turns the cron tick into a worker invocation.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'antagna_alert_scan_tick';
    PERFORM cron.schedule(
      'antagna_alert_scan_tick',
      '*/5 * * * *',
      $cron$INSERT INTO public.cron_heartbeat (source) VALUES ('alert_scan');$cron$
    );
  END IF;
END $$;

-- ── audit + RLS ──────────────────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['alert_rules','alert_fires'])
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
      || 'USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());',
      t || '_admin_write', t, t || '_admin_write', t
    );
  END LOOP;
END $$;

-- updated_at for alert_rules
DROP TRIGGER IF EXISTS trg_alert_rules_touch_updated_at ON public.alert_rules;
CREATE TRIGGER trg_alert_rules_touch_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
