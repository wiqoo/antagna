-- Track the one-time final-deadline reminder so the daily cron doesn't re-send.
ALTER TABLE external_jobs
  ADD COLUMN IF NOT EXISTS final_reminder_sent_at timestamptz;
