-- Sprint 0 Phase A (1/2) — vocabulary reconciliation: capabilities → skills
--
-- D-038 reclaims the word "capabilities" for fine-grained access codes and
-- renames the existing skills catalog (shooter / editor / drone_pilot …) to
-- "skills". D-041 records the live-DB wrinkle this migration handles:
--
--   * `skills` / `user_skills` ALREADY EXIST as empty stubs (0 rows) with a
--     different shape (uuid id PK). They block a blind RENAME, so we DROP them
--     first. Verified empty on 2026-05-29 before writing this migration.
--   * `capabilities` (21 rows) / `user_capabilities` (19 rows) carry the real
--     data and are renamed in place, keeping the (key text PK) shape.
--
-- The new fine-grained access codes do NOT live here — they extend the
-- existing `permissions` table in migration 049 (NOT a new `capabilities`
-- table). See D-041.

BEGIN;

-- 0. Drop the audit triggers migration 010 bound to the OLD table names. They
--    would otherwise survive the RENAME under stale names (trg_capabilities_*
--    on the renamed table) and mis-fire on replay. Recreated with correct names
--    at the end. (No touch_updated_at triggers exist — neither table has an
--    updated_at column — but IF EXISTS makes the drops harmless either way.)
DROP TRIGGER IF EXISTS trg_capabilities_audit              ON capabilities;
DROP TRIGGER IF EXISTS trg_capabilities_touch_updated_at   ON capabilities;
DROP TRIGGER IF EXISTS trg_user_capabilities_audit            ON user_capabilities;
DROP TRIGGER IF EXISTS trg_user_capabilities_touch_updated_at ON user_capabilities;

-- 1. Drop the empty skills stubs (0 rows; only referenced by an unused
--    Drizzle definition + one read in /team/[id] that 049's code sweep fixes).
--    CASCADE also removes their RLS policies / FKs.
DROP TABLE IF EXISTS user_skills CASCADE;
DROP TABLE IF EXISTS skills CASCADE;

-- 2. Rename the real catalog tables.
ALTER TABLE capabilities      RENAME TO skills;
ALTER TABLE user_capabilities RENAME TO user_skills;

-- 3. Rename the join column capability_key → skill_key to match the new name.
ALTER TABLE user_skills RENAME COLUMN capability_key TO skill_key;

-- 4. Rename constraints + indexes so the names track the table (avoids
--    collisions if a later migration recreates anything named skills_*).
ALTER INDEX capabilities_pkey      RENAME TO skills_pkey;
ALTER INDEX user_capabilities_pkey RENAME TO user_skills_pkey;

-- FK constraint names (created by the original migration as
-- user_capabilities_*_fkey) — rename to track. Names are deterministic from
-- the old table/column, so rename by their current identifiers.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'user_skills'::regclass AND contype = 'f'
  LOOP
    EXECUTE format(
      'ALTER TABLE user_skills RENAME CONSTRAINT %I TO %I',
      c.conname,
      replace(replace(c.conname, 'user_capabilities', 'user_skills'),
              'capability_key', 'skill_key')
    );
  END LOOP;
END $$;

-- 5. Re-arm the audit triggers under the new table names (mirror migration 010,
--    audit only — no updated_at columns so no touch trigger).
CREATE TRIGGER trg_skills_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();
CREATE TRIGGER trg_user_skills_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.user_skills
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();

COMMIT;
