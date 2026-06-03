-- 066 — grant deal/project creation to project_manager + account_manager
--
-- Bug: clicking "مشروع جديد" bounced these roles back to /dashboard. Root cause:
-- /projects/new requires `project.create`, but the project_manager position
-- (and account_manager) was never granted it — even though winning deals +
-- creating projects is responsibility #1 in both their job descriptions. The PM
-- already had project.update / change_stage / brief.create / client.create
-- (everything to MANAGE a project) but not project.create to MAKE one.
--
-- has_permission reads this table live, so this takes effect immediately (no
-- redeploy). Idempotent.

INSERT INTO public.position_default_permissions (position_key, permission_key) VALUES
  ('project_manager', 'project.create'),
  ('project_manager', 'quote.create'),
  ('account_manager', 'project.create'),
  ('account_manager', 'quote.create'),
  ('account_manager', 'brief.create'),
  ('account_manager', 'brief.parse_ai'),
  ('account_manager', 'client.create')
ON CONFLICT (position_key, permission_key) DO NOTHING;
