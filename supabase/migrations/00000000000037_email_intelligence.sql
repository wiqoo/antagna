-- Email Intelligence — deep extraction + suggestion queue.
-- Layered on top of email_threads.ai_summary + ai_topic_tags (which stays as
-- the lightweight first pass). This is the structured, actionable layer.

-- ── email_extractions ────────────────────────────────────────────────────
-- One row per (thread, message) we deep-extracted. Idempotent on
-- (message_id) — re-running just overwrites with the latest model output.

CREATE TABLE IF NOT EXISTS email_extractions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       uuid NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  message_id      uuid NOT NULL UNIQUE REFERENCES email_messages(id) ON DELETE CASCADE,

  -- The full structured payload (sender / intent / project_signals / dates /
  -- budget / deliverables / action_items / sentiment / urgency / language).
  -- Shape is enforced in the lib, not in DB, so we can evolve without
  -- migrations.
  data            jsonb        NOT NULL,
  confidence      numeric(3,2) NOT NULL,

  model           text         NOT NULL,
  input_tokens    integer      NOT NULL DEFAULT 0,
  output_tokens   integer      NOT NULL DEFAULT 0,
  cost_usd        numeric(10,6) NOT NULL DEFAULT 0,

  extracted_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_extractions_thread_idx
  ON email_extractions (thread_id);
CREATE INDEX IF NOT EXISTS email_extractions_extracted_at_idx
  ON email_extractions (extracted_at DESC);

ALTER TABLE email_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_extractions_read ON email_extractions FOR SELECT
  USING (auth.role() = 'authenticated' OR is_admin_caller());

COMMENT ON TABLE email_extractions IS
  'Pillar 8: structured AI extraction per email message — sender, intent, project signals, dates, budget, deliverables, action items.';

-- ── ai_suggestions ───────────────────────────────────────────────────────
-- Each business email may produce 0-N proposed actions. PMs / admins
-- approve or reject from /inbox/suggestions. Approved ones execute and
-- write the result back to the source-of-truth tables.

CREATE TYPE ai_suggestion_status AS ENUM (
  'pending', 'approved', 'rejected', 'executed', 'failed', 'expired'
);

CREATE TYPE ai_suggestion_type AS ENUM (
  'create_client',
  'create_contact',
  'create_project',
  'update_project',
  'create_task',
  'create_lead',
  'link_thread_to_project',
  'reply_draft',
  'escalate_to_human'
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which thing in the system generated this? Always 'email' for Phase 1
  -- but generic so we can plug in WhatsApp / meeting notes later.
  source_type         text NOT NULL DEFAULT 'email',
  source_thread_id    uuid REFERENCES email_threads(id) ON DELETE SET NULL,
  source_message_id   uuid REFERENCES email_messages(id) ON DELETE SET NULL,
  source_extraction_id uuid REFERENCES email_extractions(id) ON DELETE SET NULL,

  suggestion_type     ai_suggestion_type NOT NULL,

  -- Type-specific payload — see lib/email-intelligence/types.ts for shape
  -- per suggestion_type. Always parseable JSON.
  proposed_data       jsonb NOT NULL,

  -- One-line description in Arabic for the queue list.
  summary_ar          text  NOT NULL,
  confidence          numeric(3,2) NOT NULL,

  status              ai_suggestion_status NOT NULL DEFAULT 'pending',
  approved_by_id      uuid REFERENCES profiles(id),
  approved_at         timestamptz,
  executed_at         timestamptz,
  execution_result    jsonb,
  rejected_reason     text,

  -- Pending suggestions older than this drop off the queue automatically
  -- so we don't accumulate stale work.
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '14 days'),

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_suggestions_pending_idx
  ON ai_suggestions (created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ai_suggestions_source_idx
  ON ai_suggestions (source_thread_id) WHERE source_thread_id IS NOT NULL;

ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_suggestions_read ON ai_suggestions FOR SELECT
  USING (auth.role() = 'authenticated' OR is_admin_caller());
CREATE POLICY ai_suggestions_write ON ai_suggestions FOR ALL
  USING (is_admin_caller())
  WITH CHECK (is_admin_caller());

CREATE TRIGGER trg_ai_suggestions_touch
  BEFORE UPDATE ON ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

COMMENT ON TABLE ai_suggestions IS
  'Pending AI proposals (create client/project/task etc.) awaiting human approval. Executed ones write to the source-of-truth tables and record the result.';
