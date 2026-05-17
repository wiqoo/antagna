-- Pillar 2 §14 — Seed lookup tables.
-- These are catalog / reference tables that need data for the app to function
-- (capabilities are referenced by user_capabilities, notification event types
-- are referenced by subscriptions, etc.). NOT user data — see config/roles.yaml
-- for that (and the seed.ts script which Mohammed runs locally if needed).
--
-- Idempotent via ON CONFLICT DO NOTHING / unique keys.

-- ── capabilities (from Pillar 2 §3.3 catalog) ─────────────────────────────────

INSERT INTO public.capabilities (key, name_ar, name_en, category, position) VALUES
  ('shooter',            'مصور',           'Shooter',            'production', 10),
  ('editor',             'مونتير',         'Editor',             'post',       20),
  ('colorist',           'كولرست',         'Colorist',           'post',       30),
  ('drone_pilot',        'طيار درون',      'Drone Pilot',        'production', 40),
  ('sound_engineer',     'مهندس صوت',      'Sound Engineer',     'production', 50),
  ('production_manager', 'مدير إنتاج',     'Production Manager', 'business',   60),
  ('project_manager',    'مدير مشاريع',    'Project Manager',    'business',   70),
  ('account_manager',    'اكاونت مانجر',   'Account Manager',    'business',   80),
  ('equipment_manager',  'مسؤول معدات',    'Equipment Manager',  'admin',      90),
  ('procurement',        'مشتريات',        'Procurement',        'admin',     100),
  ('hr',                 'موارد بشرية',    'HR',                 'admin',     110),
  ('accounting',         'محاسبة',         'Accounting',         'admin',     120),
  ('talent',             'تالنت',          'Talent',             'production',130),
  ('ai_specialist',      'أخصائي AI',      'AI Specialist',      'business',  140),
  ('trainee',            'متدرب',          'Trainee',            'admin',     150),
  ('director',           'مخرج',           'Director',           'production',  5),
  ('approver',           'معتمد',          'Approver',           'business',   75),
  ('art_director',       'مدير فني',       'Art Director',       'production', 45),
  ('stylist',            'ستايلست',        'Stylist',            'production',135),
  ('makeup',             'ميكب',           'Makeup',             'production',136),
  ('production_assistant','مساعد إنتاج',  'Production Assistant','production',125)
ON CONFLICT (key) DO NOTHING;

-- ── departments (Volt's org structure — minimal seed) ────────────────────────

INSERT INTO public.departments (code, name_ar, name_en, position) VALUES
  ('GM',       'الإدارة العامة',       'General Management',   10),
  ('OP',       'العمليات',            'Operations',           20),
  ('CREATIVE', 'الفريق الإبداعي',     'Creative',             30),
  ('MC',       'الإعلانات والتواصل',  'Marketing & Comms',    40),
  ('F_HR',     'المالية والموارد البشرية', 'Finance & HR',    50)
ON CONFLICT (code) DO NOTHING;

-- ── notification_event_types (Pillar 11 will add more; seed the obvious ones) ─

INSERT INTO public.notification_event_types (key, name_ar, name_en, category, default_on, default_channels) VALUES
  ('project.assigned',                  'تعيين على مشروع',                    'Project assigned',                'projects', true,  ARRAY['in_app','email']::text[]),
  ('project.stage_changed',             'تغيّر مرحلة المشروع',                'Project stage changed',           'projects', true,  ARRAY['in_app']::text[]),
  ('task.overdue',                      'مهمة متأخرة',                        'Task overdue',                    'tasks',    true,  ARRAY['in_app','email']::text[]),
  ('task.assigned',                     'تعيين مهمة',                         'Task assigned',                   'tasks',    true,  ARRAY['in_app']::text[]),
  ('deliverable.submitted_for_director','تم رفع deliverable للمراجعة (Director)','Deliverable submitted for Director','deliverables', true, ARRAY['in_app','email']::text[]),
  ('deliverable.pending_director_24h',  'deliverable معلّق عند Director > 24س','Deliverable pending Director SLA','deliverables', true, ARRAY['in_app','email']::text[]),
  ('deliverable.pending_am_24h',        'deliverable معلّق عند AM > 24س',     'Deliverable pending AM SLA',      'deliverables', true, ARRAY['in_app','email']::text[]),
  ('deliverable.approved_by_director',  'تم اعتماد deliverable من Director',  'Deliverable approved by Director','deliverables', true, ARRAY['in_app']::text[]),
  ('deliverable.approved_by_am',        'تم اعتماد deliverable من AM',        'Deliverable approved by AM',      'deliverables', true, ARRAY['in_app']::text[]),
  ('deliverable.revisions_back_to_creator','مطلوب تعديلات على deliverable',   'Revisions requested',             'deliverables', true, ARRAY['in_app','email']::text[]),
  ('deliverable.client_ready',          'deliverable جاهز للعميل',            'Deliverable ready for client',    'deliverables', true, ARRAY['in_app']::text[]),
  ('mention.in_comment',                'تم منشنك في تعليق',                  'Mentioned in a comment',          'comms',    true,  ARRAY['in_app','email']::text[]),
  ('equipment.charging_needed',         'بطارية تحتاج شحن',                   'Battery needs charging',          'equipment',true,  ARRAY['in_app']::text[]),
  ('equipment.reservation_conflict',    'تعارض في حجز معدّات',                'Equipment reservation conflict',  'equipment',true,  ARRAY['in_app','email']::text[])
ON CONFLICT (key) DO NOTHING;

-- ── tags (common labels — Pillar 12 will expand) ──────────────────────────────

INSERT INTO public.tags (key, name_ar, name_en, color, category) VALUES
  ('urgent',      'عاجل',        'Urgent',       '#ff5a5a', 'priority'),
  ('vip',         'VIP',         'VIP',          '#f5d60a', 'client'),
  ('blocked',     'متوقف',       'Blocked',      '#ff8b3d', 'status'),
  ('archived',    'مؤرشف',       'Archived',     '#7d8a90', 'status'),
  ('social_only', 'سوشيال فقط',  'Social only',  '#3dd8ff', 'usage'),
  ('confidential','سري',         'Confidential', '#6cd29a', 'access')
ON CONFLICT (key) DO NOTHING;
