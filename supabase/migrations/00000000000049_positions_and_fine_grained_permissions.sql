-- Sprint 0 Phase A (2/2) + Phase B/C foundations — positions + fine-grained access codes
--
-- Implements D-037 (16-position × field-masking) reconciled per D-041:
--   * NEW access codes EXTEND the existing `permissions` table (not a new
--     `capabilities` table).
--   * `role_default_permissions` → `position_default_permissions` (keyed by
--     position, not role). Data is disposable (all profiles are smoke/test
--     except equipment rows, per Mohammed 2026-05-29), so we TRUNCATE + reseed
--     cleanly from the spec rather than mapping the old 144 role rows.
--   * `has_permission()` resolution switches from role → effective positions
--     (primary `profiles.position_key` + multi-hat `user_position_overrides`).
--     The blanket `role='system_admin' → true` bypass is REMOVED so that a
--     system_admin / production_director is still bound by field restrictions
--     (spec Test 10: غريب must NOT see contracted_value). The only wildcard is
--     `'*'`, held by general_manager (spec Part 1 #1).
--   * Where spec Part 1 (capability lists) and Part 2 (field-masking matrix)
--     disagree — notably production_director seeing client/contact data — we
--     follow Part 2, the authoritative masking matrix.
--
-- Field-level masking itself lands in Phase D (v_*_safe views). This migration
-- builds the permission graph those views + can() read.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. New fine-grained permission codes (read-scope + field + approval).
-- ─────────────────────────────────────────────────────────────────────────
-- Wildcard sentinel: position_default_permissions.permission_key has an FK to
-- permissions.key, so the '*' grant (general_manager) needs a real row. It is a
-- sentinel meaning "all permissions" — has_permission() treats it specially.
INSERT INTO permissions (key, category, description_ar, risk_level) VALUES
  ('*', 'system', 'كل الصلاحيات (wildcard — للمدير العام فقط)', 'high')
ON CONFLICT (key) DO NOTHING;

INSERT INTO permissions (key, category, description_ar, risk_level) VALUES
  ('projects.read.all',            'projects',  'شوف كل المشاريع',                 'normal'),
  ('projects.read.assigned',       'projects',  'شوف المشاريع المعيّن عليها فقط',   'normal'),
  ('projects.read.financial',      'projects',  'شوف الحقول المالية للمشروع',       'high'),
  ('projects.read.client_contacts','projects',  'شوف بيانات وجهات اتصال العميل',    'normal'),
  ('projects.read.internal_notes', 'projects',  'شوف الملاحظات الداخلية + تحليل AI', 'normal'),
  ('clients.read.all',             'clients',   'شوف كل العملاء',                   'normal'),
  ('clients.read.own',             'clients',   'شوف عملاءه فقط',                   'normal'),
  ('clients.read.contacts',        'clients',   'شوف تفاصيل جهات الاتصال',          'normal'),
  ('clients.read.financial',       'clients',   'شوف CR / VAT / شروط الدفع',        'high'),
  ('email_threads.read.all',       'comms',     'شوف كل محادثات البريد',            'normal'),
  ('email_threads.read.assigned',  'comms',     'شوف محادثات مشاريعه/عملائه فقط',   'normal'),
  ('equipment.read.financial',     'equipment', 'شوف سعر الشراء وقيمة التأمين',     'high'),
  ('financials.read',              'money',     'شوف البيانات المالية',             'high'),
  ('financials.read.team',         'money',     'شوف رواتب الفريق',                 'high'),
  ('financials.read.own',          'money',     'شوف راتبه الخاص',                  'normal'),
  ('team.read',                    'people',    'شوف بيانات الفريق',               'normal'),
  ('team.read.salaries',           'people',    'شوف رواتب الفريق',                 'high'),
  ('approval.creative',            'projects',  'يعتمد الأعمال الإبداعية',          'normal'),
  ('approval.financial',           'money',     'يعتمد البنود المالية',             'high'),
  ('approval.strategic',           'projects',  'يعتمد القرارات الاستراتيجية',      'high')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. positions catalog (16 positions from spec Part 1).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS positions (
  key          text PRIMARY KEY,
  name_ar      text NOT NULL,
  name_en      text NOT NULL,
  description  text,
  position     integer NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true
);

INSERT INTO positions (key, name_ar, name_en, position) VALUES
  ('general_manager',      'المدير العام',          'General Manager',       1),
  ('creative_director',    'المدير الإبداعي',       'Creative Director',     2),
  ('production_director',  'مدير الإنتاج',          'Production Director',   3),
  ('project_manager',      'مدير المشاريع',         'Project Manager',       4),
  ('account_manager',      'مدير الحسابات',         'Account Manager',       5),
  ('videographer',         'مصوّر',                 'Videographer',          6),
  ('video_editor',         'محرّر فيديو',           'Video Editor',          7),
  ('photo_editor',         'محرّر صور',             'Photo Editor',          8),
  ('equipment_technician', 'فني المعدّات',          'Equipment Technician',  9),
  ('procurement',          'المشتريات',             'Procurement',          10),
  ('financial_manager',    'المدير المالي',         'Financial Manager',    11),
  ('accountant',           'محاسب',                 'Accountant',           12),
  ('hr_manager',           'مدير الموارد البشرية',  'HR Manager',           13),
  ('system_admin',         'مسؤول النظام',          'System Admin',         14),
  ('trainee',              'متدرّب',                'Trainee',              15),
  ('freelancer',           'مستقل',                 'Freelancer',           16)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. profiles.position_key + multi-hat overrides.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS position_key text REFERENCES positions(key);

CREATE TABLE IF NOT EXISTS user_position_overrides (
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  position_key text NOT NULL REFERENCES positions(key),
  is_primary   boolean NOT NULL DEFAULT false,
  reason       text,
  granted_by   uuid REFERENCES profiles(id),
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, position_key)
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. role_default_permissions → position_default_permissions (rename + reseed).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE role_default_permissions RENAME TO position_default_permissions;
ALTER TABLE position_default_permissions RENAME COLUMN role TO position_key;
TRUNCATE position_default_permissions;

-- Seed the 16-position matrix. '*' = wildcard (general_manager only).
-- general_manager — everything.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'general_manager', k FROM unnest(ARRAY['*']) AS k;

-- creative_director.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'creative_director', k FROM unnest(ARRAY[
  'project.read','projects.read.all','projects.read.financial','projects.read.client_contacts','projects.read.internal_notes',
  'client.read','clients.read.all','clients.read.contacts',
  'email_threads.read.all','team.read',
  'ai_suggestion.review','ai_suggestion.approve','approval.creative',
  'deliverable.approve','deliverable.update','project.assign',
  'user.update_self','user.read','daily_task.manage_self'
]) AS k;

-- production_director (Mohammed primary) — full ops + admin, NO financial.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'production_director', k FROM unnest(ARRAY[
  'project.read','project.create','project.update','project.update_any','project.change_stage','project.assign','project.archive',
  'projects.read.all','projects.read.internal_notes','projects.read.client_contacts',
  'client.read','client.create','client.update','clients.read.all','clients.read.contacts','contact.create','contact.update',
  'equipment.read','equipment.checkout','equipment.return','equipment.reserve','equipment.reserve_urgent','equipment.update','equipment.archive','equipment.mark_lost',
  'email_threads.read.assigned',
  'team.read','ai_suggestion.review','ai_suggestion.approve','ai_suggestion.tune',
  'access.manage','automation.manage','settings.update','audit.read','ai.cost_dashboard.read','user.invite','user.read','user.update_role','user.update_self',
  'brief.create','brief.parse_ai','deliverable.approve','deliverable.update','revision.start','revision.resolve',
  'daily_task.manage_self'
]) AS k;

-- project_manager.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'project_manager', k FROM unnest(ARRAY[
  'project.read','project.update','project.change_stage','project.assign',
  'projects.read.assigned','projects.read.client_contacts',
  -- NOTE: projects.read.internal_notes intentionally EXCLUDED (spec Part 1 §4).
  'client.read','client.create','client.update','clients.read.own','clients.read.contacts','contact.create','contact.update',
  'email_threads.read.assigned','email.send',
  'equipment.read','equipment.reserve',
  'ai_suggestion.review','ai_suggestion.approve',
  'deliverable.update','revision.start','revision.resolve','brief.create','brief.parse_ai',
  'user.update_self','user.read','daily_task.manage_self'
]) AS k;

-- account_manager.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'account_manager', k FROM unnest(ARRAY[
  'project.read','projects.read.assigned','projects.read.client_contacts',
  -- NOTE: projects.read.internal_notes intentionally EXCLUDED (spec Part 1 §5).
  'client.read','client.update','clients.read.own','clients.read.contacts','contact.create','contact.update',
  'email_threads.read.assigned','email.send','whatsapp.send',
  'ai_suggestion.review','ai_suggestion.approve','project.assign',
  'user.update_self','user.read','daily_task.manage_self'
]) AS k;

-- videographer.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'videographer', k FROM unnest(ARRAY[
  'project.read','projects.read.assigned',
  'equipment.read','equipment.checkout','equipment.return','equipment.reserve',
  'daily_task.manage_self','user.update_self','user.read'
]) AS k;

-- video_editor / photo_editor (inherit videographer + edit/revision).
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT p, k FROM unnest(ARRAY['video_editor','photo_editor']) AS p
CROSS JOIN unnest(ARRAY[
  'project.read','projects.read.assigned','equipment.read',
  'deliverable.update','revision.resolve',
  'daily_task.manage_self','user.update_self','user.read'
]) AS k;

-- equipment_technician — sees equipment financials (insurance/value).
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'equipment_technician', k FROM unnest(ARRAY[
  'project.read','projects.read.assigned',
  'equipment.read','equipment.read.financial','equipment.checkout','equipment.return','equipment.reserve','equipment.reserve_urgent','equipment.update','equipment.mark_lost','equipment.archive',
  'daily_task.manage_self','user.update_self','user.read'
]) AS k;

-- procurement — equipment prices, no project/client access.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'procurement', k FROM unnest(ARRAY[
  'equipment.read','equipment.read.financial','equipment.update',
  'daily_task.manage_self','user.update_self','user.read'
]) AS k;

-- financial_manager — full financial + approval, no internal AI notes.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'financial_manager', k FROM unnest(ARRAY[
  'project.read','projects.read.all','projects.read.financial',
  'client.read','clients.read.all','clients.read.financial',
  'financials.read','financials.read.team',
  'equipment.read','equipment.read.financial','approval.financial',
  'quote.create','quote.send','invoice.issue','invoice.cancel','payment.record',
  'user.update_self','user.read','daily_task.manage_self'
]) AS k;

-- accountant — executes financials, no team salaries, no approval.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'accountant', k FROM unnest(ARRAY[
  'project.read','projects.read.all','projects.read.financial',
  'client.read','clients.read.all','clients.read.financial',
  'financials.read','equipment.read','equipment.read.financial',
  'quote.create','payment.record',
  'user.update_self','user.read','daily_task.manage_self'
]) AS k;

-- hr_manager — team + salaries + invites, no projects/clients/email.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'hr_manager', k FROM unnest(ARRAY[
  'team.read','team.read.salaries','financials.read.team',
  'user.invite','user.read','user.update_self','daily_task.manage_self'
]) AS k;

-- system_admin — production_director ops + admin, explicitly NO financial.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'system_admin', k FROM unnest(ARRAY[
  'project.read','project.create','project.update','project.update_any','project.change_stage','project.assign','project.archive','project.delete',
  'projects.read.all','projects.read.internal_notes','projects.read.client_contacts',
  'client.read','client.create','client.update','client.merge','clients.read.all','clients.read.contacts','contact.create','contact.update',
  'equipment.read','equipment.checkout','equipment.return','equipment.reserve','equipment.reserve_urgent','equipment.update','equipment.archive','equipment.mark_lost',
  'email_threads.read.all','email.send','email.template_create','whatsapp.send',
  'team.read','ai_suggestion.review','ai_suggestion.approve','ai_suggestion.tune','ai_suggestion.auto_execute',
  'access.manage','automation.manage','settings.update','audit.read','ai.cost_dashboard.read','user.invite','user.read','user.update_role','user.update_self',
  'brief.create','brief.parse_ai','deliverable.approve','deliverable.update','revision.start','revision.resolve',
  'daily_task.manage_self'
]) AS k;

-- trainee.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'trainee', k FROM unnest(ARRAY[
  'project.read','projects.read.assigned','equipment.read',
  'daily_task.manage_self','user.update_self','user.read'
]) AS k;

-- freelancer — assigned projects only, no client/financial/equipment.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT 'freelancer', k FROM unnest(ARRAY[
  'project.read','projects.read.assigned','daily_task.manage_self','user.update_self'
]) AS k;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Map the current (smoke) profiles to positions + multi-hat.
-- ─────────────────────────────────────────────────────────────────────────
-- Default by old role.
UPDATE profiles SET position_key = 'account_manager'    WHERE role = 'account_manager';
UPDATE profiles SET position_key = 'financial_manager'  WHERE role = 'finance';
UPDATE profiles SET position_key = 'general_manager'    WHERE role = 'general_manager';
UPDATE profiles SET position_key = 'hr_manager'         WHERE role = 'hr';
UPDATE profiles SET position_key = 'project_manager'    WHERE role = 'project_manager';
UPDATE profiles SET position_key = 'videographer'       WHERE role = 'user';

-- Specific people (by email).
-- Mohammed = production_director PRIMARY (NO financial) + system_admin hat.
UPDATE profiles SET position_key = 'production_director' WHERE email = 'mohammedelghareib@gmail.com';
-- Abu Luka = general_manager PRIMARY + creative_director hat.
UPDATE profiles SET position_key = 'general_manager'    WHERE email = 'fake.abu-luka@antagna.test';
-- QA bots → general_manager so visual + E2E QA can reach every page/field.
UPDATE profiles SET position_key = 'general_manager'    WHERE email IN ('claude.qa@antagna.me','e2e-admin@antagna.test');
-- Operational team specifics.
UPDATE profiles SET position_key = 'equipment_technician' WHERE email = 'fake.musaed@antagna.test';
UPDATE profiles SET position_key = 'procurement'          WHERE email = 'fake.kabsy@antagna.test';
UPDATE profiles SET position_key = 'trainee'              WHERE email = 'fake.ahmed@antagna.test';

-- Multi-hat overrides.
INSERT INTO user_position_overrides (profile_id, position_key, reason)
SELECT id, 'system_admin', 'Mohammed wears the SysAdmin hat (D-037)'
FROM profiles WHERE email = 'mohammedelghareib@gmail.com'
ON CONFLICT DO NOTHING;

-- TEMP (Mohammed's request, 2026-05-29): grant غريب FULL access during the
-- build via a general_manager hat ('*' wildcard). This INTENTIONALLY overrides
-- the production_director "no financial" restriction (spec Test 10). REMOVE
-- this single row to restore the intended restriction. Tracked as a manual
-- cleanup item in CHECKLIST.md.
INSERT INTO user_position_overrides (profile_id, position_key, reason)
SELECT id, 'general_manager', 'TEMP full access during build — DELETE to re-enforce production_director (Test 10)'
FROM profiles WHERE email = 'mohammedelghareib@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO user_position_overrides (profile_id, position_key, reason)
SELECT id, 'creative_director', 'Abu Luka also acts as Creative Director (spec Part 1 #2)'
FROM profiles WHERE email = 'fake.abu-luka@antagna.test'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. has_permission() — resolve by effective positions (NO system_admin bypass).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_permission(p_profile_id uuid, p_key text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_override boolean;
BEGIN
  IF p_profile_id IS NULL THEN RETURN false; END IF;

  -- 1. Per-user permission override (highest precedence; respects expiry).
  SELECT granted INTO v_override
  FROM public.user_permission_overrides
  WHERE profile_id = p_profile_id
    AND permission_key = p_key
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  IF FOUND THEN RETURN v_override; END IF;

  -- 2. Position default — across ALL effective positions (primary + multi-hat).
  --    '*' wildcard grants everything (general_manager). No role bypass: a
  --    system_admin / production_director stays bound by field restrictions.
  RETURN EXISTS (
    SELECT 1 FROM public.position_default_permissions pdp
    WHERE pdp.position_key IN (
        SELECT position_key FROM public.profiles
         WHERE id = p_profile_id AND position_key IS NOT NULL
        UNION
        SELECT position_key FROM public.user_position_overrides
         WHERE profile_id = p_profile_id
           AND (expires_at IS NULL OR expires_at > now())
      )
      AND (pdp.permission_key = p_key OR pdp.permission_key = '*')
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. has_capability() — read the renamed user_skills / skill_key (migration 048).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_capability(p_profile_id uuid, p_capability_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_skills
    WHERE profile_id = p_profile_id
      AND skill_key = p_capability_key
  );
$function$;

COMMIT;
