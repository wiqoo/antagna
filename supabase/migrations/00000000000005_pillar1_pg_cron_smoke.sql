-- Pillar 1 §1 success criterion #6:
--   "pg_cron runs a 1-minute scheduled query that logs to a table."
--
-- This migration:
--   1. Creates a tiny cron_heartbeat table.
--   2. Schedules a pg_cron job that inserts into it every minute.
--
-- On the Free tier (staging) pg_cron may not be available — guarded with DO block.

CREATE TABLE IF NOT EXISTS public.cron_heartbeat (
  id          bigserial PRIMARY KEY,
  beat_at     timestamptz NOT NULL DEFAULT now(),
  source      text NOT NULL DEFAULT 'pg_cron'
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule any previous run of this job
    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE jobname = 'antagna_heartbeat';

    -- Reschedule every minute
    PERFORM cron.schedule(
      'antagna_heartbeat',
      '* * * * *',
      $cron$INSERT INTO public.cron_heartbeat (source) VALUES ('pg_cron');$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled on this project — cron_heartbeat table created but no schedule';
  END IF;
END $$;
