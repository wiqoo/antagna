-- Pillar 8 — Communications Layer: email threads/messages/drafts/templates,
-- Gmail watch state, WhatsApp (Baileys per D-023), meeting_notes.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_direction') THEN
    CREATE TYPE email_direction AS ENUM ('inbound','outbound','internal');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_draft_status') THEN
    CREATE TYPE email_draft_status AS ENUM ('draft','awaiting_review','approved','queued','sent','failed','cancelled');
  END IF;
END $$;

-- ── email_threads ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_threads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_thread_id       text NOT NULL UNIQUE,
  subject               text,
  project_id            uuid REFERENCES public.projects(id),
  lead_id               uuid REFERENCES public.leads(id),
  client_id             uuid REFERENCES public.clients(id),
  primary_contact_id    uuid REFERENCES public.contacts(id),
  assigned_profile_id   uuid REFERENCES public.profiles(id),
  status                text NOT NULL DEFAULT 'open',
  message_count         integer NOT NULL DEFAULT 0,
  last_message_at       timestamptz,
  last_inbound_at       timestamptz,
  last_outbound_at      timestamptz,
  ai_summary            text,
  ai_summary_updated_at timestamptz,
  ai_topic_tags         text[],
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS et_project_idx ON public.email_threads (project_id);
CREATE INDEX IF NOT EXISTS et_client_idx  ON public.email_threads (client_id);
CREATE INDEX IF NOT EXISTS et_assigned_idx ON public.email_threads (assigned_profile_id);
CREATE INDEX IF NOT EXISTS et_status_idx  ON public.email_threads (status);
CREATE INDEX IF NOT EXISTS et_last_msg_idx ON public.email_threads (last_message_at DESC);

-- ── email_messages ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             uuid NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  gmail_message_id      text UNIQUE,
  internet_message_id   text,
  in_reply_to           text,
  direction             email_direction NOT NULL,
  from_email            text NOT NULL,
  from_name             text,
  to_emails             text[] NOT NULL,
  cc_emails             text[],
  bcc_emails            text[],
  subject               text,
  body_html             text,
  body_text             text,
  snippet               text,
  attachment_count      integer NOT NULL DEFAULT 0,
  sent_by_profile_id    uuid REFERENCES public.profiles(id),
  acting_as_profile_id  uuid REFERENCES public.profiles(id),
  ai_summary            text,
  ai_suggested_actions  jsonb,
  sent_at               timestamptz NOT NULL,
  ingested_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_by_thread ON public.email_messages (thread_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS messages_from_idx  ON public.email_messages (from_email);

-- Maintain email_threads counters on every message insert/delete.
CREATE OR REPLACE FUNCTION public.fn_update_thread_counters()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  v_thread_id := COALESCE(NEW.thread_id, OLD.thread_id);
  UPDATE public.email_threads et
  SET
    message_count    = (SELECT count(*)        FROM public.email_messages WHERE thread_id = v_thread_id),
    last_message_at  = (SELECT max(sent_at)    FROM public.email_messages WHERE thread_id = v_thread_id),
    last_inbound_at  = (SELECT max(sent_at)    FROM public.email_messages WHERE thread_id = v_thread_id AND direction = 'inbound'),
    last_outbound_at = (SELECT max(sent_at)    FROM public.email_messages WHERE thread_id = v_thread_id AND direction = 'outbound')
  WHERE et.id = v_thread_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tg_update_thread_counters ON public.email_messages;
CREATE TRIGGER tg_update_thread_counters
  AFTER INSERT OR UPDATE OR DELETE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_thread_counters();

-- ── email_templates ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_templates (
  key                 text PRIMARY KEY,
  name_ar             text NOT NULL,
  name_en             text,
  category            text,
  subject_template    text NOT NULL,
  body_template       text NOT NULL,
  required_variables  text[],
  requires_review     boolean NOT NULL DEFAULT false,
  active              boolean NOT NULL DEFAULT true
);

INSERT INTO public.email_templates (key, name_ar, name_en, category, subject_template, body_template, required_variables, requires_review) VALUES
  ('acknowledgement_en','تأكيد استلام (EN)','Acknowledgement (EN)','admin',
    'Re: {{original_subject}}',
    'Hi {{contact_name}}, Your email is well received. I will review with my team and get back to you shortly. Thank you. Best Regards, Volt Production Team',
    ARRAY['original_subject','contact_name']::text[], false),
  ('quote_cover','إيميل تغطية عرض السعر','Quote cover','sales',
    'Quotation — {{project_title}}',
    'Dear {{contact_name}}, Kindly find attached the quotation for your kind review. Please let me know if you need any additional information. Looking forward to your feedback. Best Regards, Abdullah A. Mansouri, Account Manager VOLT PRODUCTION TEAM',
    ARRAY['project_title','contact_name']::text[], true),
  ('chase_30d','تذكير دفع 30 يوم','Chase reminder 30d','chase',
    'Reminder — Invoice {{invoice_code}} – {{client_name}}',
    'Dear {{contact_name}}, I hope you are doing well. This is a kind reminder regarding the outstanding amount of SAR {{amount_sar}} for invoice {{invoice_code}}, which has exceeded the agreed payment terms. We kindly request your prompt processing of the payment. Best Regards, Volt Production Team',
    ARRAY['contact_name','amount_sar','invoice_code','client_name']::text[], true),
  ('vendor_onboarding','تأهيل مورد — CR + VAT + National Address','Vendor onboarding pack','admin',
    'Volt Production — CR + VAT + National Address',
    'Dear {{contact_name}}, Please find attached our company documents for your vendor onboarding (CR 4030483856, VAT 310314280500003). Best Regards, Volt Production Team',
    ARRAY['contact_name']::text[], false)
ON CONFLICT (key) DO NOTHING;

-- ── email_drafts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_drafts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             uuid REFERENCES public.email_threads(id),
  project_id            uuid REFERENCES public.projects(id),
  invoice_id            uuid REFERENCES public.invoices(id),
  template_key          text REFERENCES public.email_templates(key),
  author_profile_id     uuid NOT NULL REFERENCES public.profiles(id),
  acting_as_profile_id  uuid REFERENCES public.profiles(id),
  send_from_alias       text NOT NULL,
  to_emails             text[] NOT NULL,
  cc_emails             text[],
  bcc_emails            text[],
  subject               text NOT NULL,
  body_html             text NOT NULL,
  body_text             text,
  status                email_draft_status NOT NULL DEFAULT 'draft',
  approver_profile_id   uuid REFERENCES public.profiles(id),
  approved_at           timestamptz,
  rejected_at           timestamptz,
  rejected_reason       text,
  scheduled_for         timestamptz,
  sent_at               timestamptz,
  sent_message_id       text,
  send_error            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ed_status_idx ON public.email_drafts (status);
CREATE INDEX IF NOT EXISTS ed_author_idx ON public.email_drafts (author_profile_id);
CREATE INDEX IF NOT EXISTS ed_scheduled_idx ON public.email_drafts (scheduled_for) WHERE status = 'approved' OR status = 'queued';

-- ── gmail_watch ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gmail_watch (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox           text NOT NULL UNIQUE,
  history_id        text,
  watch_expires_at  timestamptz,
  last_renewed_at   timestamptz,
  pubsub_topic      text,
  active            boolean NOT NULL DEFAULT true
);

-- ── whatsapp_messages (Baileys per D-023 — simpler than Meta API) ───────────

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baileys_message_id  text UNIQUE,
  direction           text NOT NULL,
  from_e164           text NOT NULL,
  to_e164             text NOT NULL,
  matched_contact_id  uuid REFERENCES public.contacts(id),
  matched_profile_id  uuid REFERENCES public.profiles(id),
  message_type        text,
  body_text           text,
  media_url           text,
  raw_payload         jsonb,
  ai_summary          text,
  ai_classification   text,
  thread_key          text,
  project_id          uuid REFERENCES public.projects(id),
  received_at         timestamptz NOT NULL,
  ingested_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wm_thread_key_idx ON public.whatsapp_messages (thread_key);
CREATE INDEX IF NOT EXISTS wm_project_idx    ON public.whatsapp_messages (project_id);
CREATE INDEX IF NOT EXISTS wm_received_idx   ON public.whatsapp_messages (received_at DESC);

-- ── meeting_notes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meeting_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text NOT NULL,
  source_id       text,
  meeting_title   text,
  meeting_date    timestamptz,
  attendees_text  text,
  note_content    text,
  drive_url       text,
  project_id      uuid REFERENCES public.projects(id),
  client_id       uuid REFERENCES public.clients(id),
  ai_action_items jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mn_project_idx ON public.meeting_notes (project_id);
CREATE INDEX IF NOT EXISTS mn_date_idx    ON public.meeting_notes (meeting_date DESC);

-- ── audit + updated_at + RLS ─────────────────────────────────────────────────

DO $$
DECLARE
  t text;
  has_updated_at boolean;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'email_threads','email_messages','email_templates','email_drafts',
    'gmail_watch','whatsapp_messages','meeting_notes'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I; ' ||
      'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();',
      t, t, t, t
    );
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=t AND column_name='updated_at') INTO has_updated_at;
    IF has_updated_at THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON public.%I; ' ||
        'CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON public.%I ' ||
        'FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();',
        t, t, t, t
      );
    END IF;
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
      || 'USING (public.current_user_has_permission(''email.send'') OR public.is_admin_caller()) '
      || 'WITH CHECK (public.current_user_has_permission(''email.send'') OR public.is_admin_caller());',
      t || '_write', t, t || '_write', t
    );
  END LOOP;
END $$;
