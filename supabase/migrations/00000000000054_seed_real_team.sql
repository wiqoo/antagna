-- Phase 0 — seed the real 11-person team (config/roles.yaml) as profiles with
-- position_key + status='invited' and NO auth user / NO email dispatch (D-040;
-- email sends held per Mohammed). Mohammed Ghareeb already exists as the real
-- user (mohammedelghareib@gmail.com) — not re-seeded. Placeholder emails for the
-- 2 people with no mailbox yet (Abu Luka, Ahmed) — replaced at real invite time.

BEGIN;

INSERT INTO profiles (email, display_name, display_name_en, legal_name, role, position_key, status) VALUES
  ('abu-luka@pending.antagna',   'أبو لوكا',        'Abu Luka',         'محمد المالكي', 'general_manager', 'general_manager',     'invited'),
  ('khalid@voltsaudi.com',       'خالد الغامدي',    'Khaled AlGhamdi',  NULL,           'project_manager', 'project_manager',     'invited'),
  ('mansouri@voltsaudi.com',     'عبدالله منصوري',  'Abdullah Mansoury',NULL,           'account_manager', 'account_manager',     'invited'),
  ('hamada@voltsaudi.com',       'حمادة',           'Hamada',           NULL,           'user',            'videographer',        'invited'),
  ('mohsen@voltsaudi.com',       'محسن',            'Mohsen',           NULL,           'user',            'videographer',        'invited'),
  ('musaed@voltsaudi.com',       'مساعد',           'Musa3ed',          NULL,           'user',            'equipment_technician','invited'),
  ('ahmed@pending.antagna',      'أحمد',            'Ahmed',            NULL,           'user',            'trainee',             'invited'),
  ('alkibsi@voltsaudi.com',      'كبسي',            'Kabsy',            NULL,           'user',            'procurement',         'invited'),
  ('hr@voltsaudi.com',           'تركي',            'Turky',            NULL,           'hr',              'hr_manager',          'invited'),
  ('finance@voltsaudi.com',      'حسين',            'Hussein',          NULL,           'finance',         'financial_manager',   'invited')
ON CONFLICT (email) DO NOTHING;

-- Multi-hat: Abu Luka also acts as Creative Director; Hamada/Mohsen also edit.
INSERT INTO user_position_overrides (profile_id, position_key, reason)
SELECT id, 'creative_director', 'Abu Luka also acts as Creative Director (roles.yaml)'
FROM profiles WHERE email = 'abu-luka@pending.antagna'
ON CONFLICT DO NOTHING;

INSERT INTO user_position_overrides (profile_id, position_key, reason)
SELECT id, 'video_editor', 'also edits (roles.yaml)'
FROM profiles WHERE email IN ('hamada@voltsaudi.com','mohsen@voltsaudi.com')
ON CONFLICT DO NOTHING;

COMMIT;
