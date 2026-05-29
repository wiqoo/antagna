-- Phase 2 foundation — new write-permission keys for the System Admin Console
-- (cost guard / brain / integrations) + a source_key column on daily_tasks so
-- the per-position routine checklist can be materialized idempotently.

BEGIN;

-- New fine-grained admin write keys (Console actions gate on these).
INSERT INTO permissions (key, category, description_ar, risk_level) VALUES
  ('ai.manage',          'system', 'إدارة حدود وميزانية الـ AI',        'high'),
  ('memory.manage',      'system', 'إدارة ذاكرة الـ AI (brain)',         'high'),
  ('integration.manage', 'system', 'إدارة التكاملات والتوكنات',          'high')
ON CONFLICT (key) DO NOTHING;

-- Grant the new keys to the admin positions (system_admin + general_manager).
-- general_manager already has '*' so it's covered; add explicit rows for
-- system_admin so a non-GM admin can use the console.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'system_admin', k FROM unnest(ARRAY['ai.manage','memory.manage','integration.manage']) AS k
ON CONFLICT DO NOTHING;

-- Routine idempotency: tag daily_tasks rows generated from a position routine.
ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS source_key text;

COMMIT;
