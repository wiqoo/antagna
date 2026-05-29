-- Fix: ensureTodayRoutine's ON CONFLICT (owner_id, source_key) failed with
-- 42P10 "no unique or exclusion constraint matching the ON CONFLICT
-- specification" because migration 056's index was PARTIAL (WHERE source_key IS
-- NOT NULL) — Postgres won't use a partial index as an ON CONFLICT arbiter
-- unless the conflict_target repeats the predicate (drizzle's onConflictDoNothing
-- doesn't emit it). A FULL unique index on (owner_id, source_key) is safe:
-- hand-created tasks have source_key NULL, and NULLs never conflict in a unique
-- index, so they're unaffected; routine rows have distinct non-null keys.

BEGIN;
DROP INDEX IF EXISTS daily_tasks_owner_source_key_uniq;
CREATE UNIQUE INDEX daily_tasks_owner_source_key_uniq
  ON daily_tasks (owner_id, source_key);
COMMIT;
