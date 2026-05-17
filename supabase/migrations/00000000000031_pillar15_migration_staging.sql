-- Pillar 15 — Migration staging tables for the legacy Volt OS pull.
-- Mohammed runs scripts/migrate-from-volt-os.ts when ready (the legacy DB at
-- jhfkgmomntkgzzycdbmt stays UNTOUCHED otherwise per his 2026-05-15 directive).

CREATE TABLE IF NOT EXISTS public.migration_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'ok' | 'failed' | 'rolled_back'
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  rows_read       jsonb NOT NULL DEFAULT '{}'::jsonb,
  rows_written    jsonb NOT NULL DEFAULT '{}'::jsonb,
  rows_skipped    jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message   text,
  dry_run         boolean NOT NULL DEFAULT false,
  notes           text
);

CREATE TABLE IF NOT EXISTS public.legacy_equipment_import (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id         text,
  legacy_payload    jsonb NOT NULL,
  new_equipment_id  uuid,
  new_group_id      uuid,
  map_status        text NOT NULL DEFAULT 'pending',
  map_notes         text,
  imported_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lei_status_idx ON public.legacy_equipment_import (map_status);

CREATE TABLE IF NOT EXISTS public.legacy_client_import (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id       text,
  legacy_payload  jsonb NOT NULL,
  new_client_id   uuid,
  map_status      text NOT NULL DEFAULT 'pending',
  map_notes       text,
  imported_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lci_status_idx ON public.legacy_client_import (map_status);

CREATE TABLE IF NOT EXISTS public.legacy_project_import (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id       text,
  legacy_payload  jsonb NOT NULL,
  new_project_id  uuid,
  map_status      text NOT NULL DEFAULT 'pending',
  map_notes       text,
  imported_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lpi_status_idx ON public.legacy_project_import (map_status);

-- ── audit + admin-only RLS (these tables hold legacy data; minimum exposure) ─

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['migration_runs','legacy_equipment_import','legacy_client_import','legacy_project_import'])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I; ' ||
      'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();',
      t, t, t, t
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I; '
      || 'CREATE POLICY %I ON public.%I FOR ALL '
      || 'USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());',
      t || '_admin_only', t, t || '_admin_only', t
    );
  END LOOP;
END $$;
