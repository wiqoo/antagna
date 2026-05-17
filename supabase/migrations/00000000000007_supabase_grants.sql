-- Pillar 1 — Supabase role grants (idempotent).
--
-- Tables created via raw SQL migrations don't go through Supabase's
-- auto-grant flow, so anon/authenticated/service_role come out with only
-- TRIGGER/TRUNCATE/REFERENCES (no DML). PostgREST then rejects every
-- supabase-js call with "permission denied for table X" even when RLS
-- would have allowed it.
--
-- Fix: grant DML privileges to the three Supabase roles on every existing
-- table in public, plus DEFAULT PRIVILEGES so future tables don't need
-- the same dance. RLS policies (00004) still gate what each role actually sees.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS
  TO anon, authenticated, service_role;
