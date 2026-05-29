-- Make the per-position My Day routine materialization race-safe.
--
-- ensureTodayRoutine() inserts one daily_tasks row per routine item per day,
-- tagged source_key='routine:<item_key>:<YYYY-MM-DD>'. Two simultaneous loads
-- of /my-day on the same day could otherwise both pass a read-then-insert check
-- and double-insert. A partial unique index on (owner_id, source_key) — only
-- where source_key is set — lets the insert use ON CONFLICT DO NOTHING and
-- guarantees at most one row per (owner, source_key). Hand-created tasks
-- (source_key NULL) are unaffected.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS daily_tasks_owner_source_key_uniq
  ON daily_tasks (owner_id, source_key)
  WHERE source_key IS NOT NULL;

COMMIT;
