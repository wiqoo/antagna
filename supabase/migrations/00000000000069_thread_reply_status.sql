-- 069 — smart reply-need + urgency on email threads
--
-- Feeds the "what needs a reply / what's urgent / cross-channel" triage upgrade.
-- reply_status: needs_reply | no_reply_needed | awaiting_them | handled_off_channel
-- is_urgent: must be handled within ~1h (drives the PM/AM escalation).
-- escalated_at: set once when the urgent escalation fires (so it never re-sends).

ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS reply_status text,
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgent_reason text,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

CREATE INDEX IF NOT EXISTS email_threads_urgent_idx
  ON public.email_threads (is_urgent) WHERE is_urgent = true;
