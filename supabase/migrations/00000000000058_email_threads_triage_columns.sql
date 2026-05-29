-- 00000000000058_email_threads_triage_columns.sql
-- Inbox AI-triage: add a per-thread category + importance so the inbox can hide
-- noise (spam / marketing / newsletter / notification) by default and surface
-- only actionable mail. classifyThread() (apps/web/src/app/inbox/actions.ts)
-- writes these. Kept separate from `status` so we never lose the human workflow
-- status (open / waiting_client / closed) when the AI re-classifies.
--
--   category   : 'actionable' | 'marketing' | 'newsletter' | 'spam' | 'notification'
--   importance : 'low' | 'medium' | 'high'
--
-- NOT NULL-free + no enum on purpose: classification is best-effort and we want
-- a NULL = "not classified yet" sentinel (the inbox treats NULL as actionable so
-- nothing is hidden before the AI has run).

ALTER TABLE email_threads
  ADD COLUMN IF NOT EXISTS category   text,
  ADD COLUMN IF NOT EXISTS importance text,
  ADD COLUMN IF NOT EXISTS ai_classified_at timestamptz;

-- Filtering by category is the inbox's default WHERE, so index it.
CREATE INDEX IF NOT EXISTS email_threads_category_idx
  ON email_threads (category);

COMMENT ON COLUMN email_threads.category IS
  'AI triage bucket: actionable | marketing | newsletter | spam | notification. NULL = unclassified (treated as actionable).';
COMMENT ON COLUMN email_threads.importance IS
  'AI triage importance: low | medium | high. NULL = unclassified.';
COMMENT ON COLUMN email_threads.ai_classified_at IS
  'When classifyThread() last set category/importance.';
