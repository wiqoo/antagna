-- Cross-thread conversation analysis — one row per thread, refreshed on
-- new message activity. Different from email_extractions (per message)
-- and email_threads.ai_summary (single-line). This is the rich arc:
--   sentiment trajectory, intent arc, decision points, outcome status.

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id                uuid NOT NULL UNIQUE REFERENCES email_threads(id) ON DELETE CASCADE,

  -- How many messages were in the thread when we summarized — lets us
  -- detect staleness and re-run only when new content arrives.
  message_count_at_summary integer NOT NULL,

  -- 4-6 sentence Arabic narrative of the conversation's arc.
  summary_ar               text    NOT NULL,

  -- Optional structured fields the model can emit.
  sentiment_trajectory     text,            -- improving | stable | declining | mixed
  intent_arc               text,            -- short free-form description
  decision_points          jsonb   NOT NULL DEFAULT '[]'::jsonb,
                                            -- [{ at: iso, type, what, by_party }]
  open_items               jsonb   NOT NULL DEFAULT '[]'::jsonb,
                                            -- ["client owes spec", "we owe quote"]
  outcome_status           text,            -- pending | won | lost | stalled

  confidence               numeric(3,2) NOT NULL,
  model                    text         NOT NULL,
  input_tokens             integer      NOT NULL DEFAULT 0,
  output_tokens            integer      NOT NULL DEFAULT 0,
  summarized_at            timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_summaries_outcome_idx
  ON conversation_summaries (outcome_status)
  WHERE outcome_status IS NOT NULL;

ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_summaries_read ON conversation_summaries FOR SELECT
  USING (auth.role() = 'authenticated' OR is_admin_caller());

COMMENT ON TABLE conversation_summaries IS
  'One AI-built summary per email thread covering its full arc (sentiment, decisions, open items, outcome). Refreshed when message_count_at_summary < thread.message_count.';
