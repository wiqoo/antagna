-- Pillar 1 — required extensions (§8.3)
-- Run order: this is migration #1. Drizzle migrations come AFTER this one.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- pg_cron lives in the `extensions` schema on Supabase; only enable on production-tier
-- projects. Conditional check so the migration is idempotent across staging (Free) +
-- prod (Pro) without erroring on staging.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS "pg_cron";
    EXCEPTION WHEN insufficient_privilege OR feature_not_supported THEN
      RAISE NOTICE 'pg_cron skipped on this project tier — enable from the Supabase dashboard';
    END;
  END IF;
END $$;
