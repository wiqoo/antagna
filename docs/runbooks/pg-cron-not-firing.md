# pg_cron not firing

**Visible symptom:** `cron_heartbeat` has no new rows in 10+ minutes; alert rules don't fire on schedule.

## Verify

```sql
SELECT max(beat_at) AS latest, count(*) AS beats_last_hour
FROM public.cron_heartbeat
WHERE beat_at > now() - interval '1 hour';

-- Are jobs scheduled?
SELECT jobname, schedule, active FROM cron.job;
```

## Likely causes

1. **Free-tier limit** — pg_cron is enabled on Supabase Free but jobs can hit
   concurrency caps. Check `cron.job_run_details` for failures.
2. **Job got unscheduled by a re-apply** — migration 00005 uses `cron.unschedule`
   defensively. Re-run that migration to re-schedule `antagna_heartbeat`.
3. **Function the job calls was renamed/dropped** — `cron.job` keeps a stale
   reference. Drop + re-schedule.

## Recovery

```sql
-- Re-schedule the heartbeat manually:
SELECT cron.unschedule('antagna_heartbeat');
SELECT cron.schedule(
  'antagna_heartbeat',
  '* * * * *',
  $$INSERT INTO public.cron_heartbeat (source) VALUES ('pg_cron');$$
);
```
