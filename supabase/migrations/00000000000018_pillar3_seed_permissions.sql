-- Pillar 3 seed: catalog of permission keys + role default grants.
-- Idempotent.

-- ── permissions catalog ──────────────────────────────────────────────────────

INSERT INTO public.permissions (key, category, description_ar, description_en, risk_level) VALUES
  -- Projects
  ('project.read',          'projects',  'قراءة المشاريع',                 'Read projects',                       'low'),
  ('project.create',        'projects',  'إنشاء مشروع',                    'Create project',                      'normal'),
  ('project.update',        'projects',  'تعديل مشروع',                    'Update project',                      'normal'),
  ('project.update_any',    'projects',  'تعديل أي مشروع (تجاوز التعيين)', 'Update any project (bypass assignment)','high'),
  ('project.delete',        'projects',  'حذف مشروع',                      'Delete project',                      'high'),
  ('project.change_stage',  'projects',  'تغيير مرحلة المشروع',            'Change project stage',                'normal'),
  ('project.assign',        'projects',  'تعيين أعضاء على المشروع',        'Assign people to project',            'normal'),
  ('project.archive',       'projects',  'أرشفة مشروع',                    'Archive project',                     'normal'),
  -- Briefs / Deliverables / Revisions
  ('brief.create',          'briefs',    'إنشاء بريف',                      'Create brief',                        'normal'),
  ('brief.parse_ai',        'briefs',    'تحليل بريف بـ AI',                'Parse brief with AI',                 'normal'),
  ('deliverable.update',    'deliverables','تعديل deliverable',             'Update deliverable',                  'normal'),
  ('deliverable.approve',   'deliverables','اعتماد deliverable',            'Approve deliverable',                 'normal'),
  ('revision.start',        'revisions', 'بدء جولة تعديلات',                'Start revision round',                'normal'),
  ('revision.resolve',      'revisions', 'إغلاق جولة تعديلات',              'Resolve revision round',              'normal'),
  -- Clients / Contacts
  ('client.read',           'clients',   'قراءة العملاء',                  'Read clients',                        'low'),
  ('client.create',         'clients',   'إنشاء عميل',                     'Create client',                       'normal'),
  ('client.update',         'clients',   'تعديل عميل',                     'Update client',                       'normal'),
  ('client.merge',          'clients',   'دمج عميلين',                      'Merge clients',                       'high'),
  ('contact.create',        'clients',   'إنشاء جهة اتصال',                 'Create contact',                      'normal'),
  ('contact.update',        'clients',   'تعديل جهة اتصال',                 'Update contact',                      'normal'),
  -- Money (mostly Dafterah-mirror; D-022)
  ('quote.create',          'money',     'إنشاء عرض سعر',                   'Create quote',                        'normal'),
  ('quote.send',            'money',     'إرسال عرض سعر',                   'Send quote',                          'normal'),
  ('invoice.issue',         'money',     'إصدار فاتورة (مرجع Dafterah)',    'Issue invoice (Dafterah-ref)',        'normal'),
  ('invoice.cancel',        'money',     'إلغاء فاتورة',                    'Cancel invoice',                      'high'),
  ('payment.record',        'money',     'تسجيل دفعة',                      'Record payment',                      'normal'),
  -- Equipment
  ('equipment.read',        'equipment', 'قراءة قائمة المعدات',             'Read equipment',                      'low'),
  ('equipment.update',      'equipment', 'تعديل بيانات معدّة',              'Update equipment',                    'normal'),
  ('equipment.reserve',     'equipment', 'حجز معدّة لمشروع',                'Reserve equipment',                   'normal'),
  ('equipment.checkout',    'equipment', 'خروج معدّة من المخزن',            'Check out equipment',                 'normal'),
  ('equipment.return',      'equipment', 'إرجاع معدّة',                     'Return equipment',                    'normal'),
  ('equipment.mark_lost',   'equipment', 'تعليم معدّة مفقودة',              'Mark equipment lost',                 'high'),
  ('equipment.archive',     'equipment', 'أرشفة معدّة',                     'Archive equipment',                   'normal'),
  -- People
  ('user.read',             'people',    'قراءة بيانات الأعضاء',            'Read user list',                      'low'),
  ('user.update_self',      'people',    'تعديل بيانات ذاتية',              'Update self',                         'low'),
  ('user.update_role',      'people',    'تغيير دور أحد الأعضاء',           'Change user role',                    'high'),
  ('user.invite',           'people',    'دعوة عضو جديد',                   'Invite new user',                     'normal'),
  -- Communications
  ('email.send',            'comms',     'إرسال إيميل من النظام',           'Send email from system',              'normal'),
  ('email.template_create', 'comms',     'إنشاء قالب إيميل',                'Create email template',               'normal'),
  ('whatsapp.send',         'comms',     'إرسال رسالة واتساب',              'Send WhatsApp message',               'normal'),
  -- System
  ('audit.read',            'system',    'قراءة سجل التدقيق',               'Read audit log',                      'normal'),
  ('ai.cost_dashboard.read','system',    'قراءة لوحة تكاليف الـ AI',         'Read AI cost dashboard',              'normal'),
  ('settings.update',       'system',    'تعديل إعدادات النظام',            'Update system settings',              'high'),
  -- Daily tasks (per Pillar 2 §5.5)
  ('daily_task.manage_self','tasks',     'إدارة المهام الشخصية',            'Manage own daily tasks',              'low')
ON CONFLICT (key) DO NOTHING;

-- ── role_default_permissions grid ────────────────────────────────────────────
-- system_admin gets EVERYTHING by virtue of the bypass in has_permission(); no
-- explicit rows needed for system_admin. We still seed it for transparency
-- (so the role/permission report is complete).

-- helper: bulk-grant by re-using a CTE
WITH role_grants(role_, key_) AS (VALUES
  -- system_admin: full set (explicit for reporting)
  ('system_admin','project.read'), ('system_admin','project.create'), ('system_admin','project.update'),
  ('system_admin','project.update_any'), ('system_admin','project.delete'), ('system_admin','project.change_stage'),
  ('system_admin','project.assign'), ('system_admin','project.archive'),
  ('system_admin','brief.create'), ('system_admin','brief.parse_ai'),
  ('system_admin','deliverable.update'), ('system_admin','deliverable.approve'),
  ('system_admin','revision.start'), ('system_admin','revision.resolve'),
  ('system_admin','client.read'), ('system_admin','client.create'), ('system_admin','client.update'), ('system_admin','client.merge'),
  ('system_admin','contact.create'), ('system_admin','contact.update'),
  ('system_admin','quote.create'), ('system_admin','quote.send'),
  ('system_admin','invoice.issue'), ('system_admin','invoice.cancel'), ('system_admin','payment.record'),
  ('system_admin','equipment.read'), ('system_admin','equipment.update'), ('system_admin','equipment.reserve'),
  ('system_admin','equipment.checkout'), ('system_admin','equipment.return'),
  ('system_admin','equipment.mark_lost'), ('system_admin','equipment.archive'),
  ('system_admin','user.read'), ('system_admin','user.update_self'), ('system_admin','user.update_role'), ('system_admin','user.invite'),
  ('system_admin','email.send'), ('system_admin','email.template_create'), ('system_admin','whatsapp.send'),
  ('system_admin','audit.read'), ('system_admin','ai.cost_dashboard.read'), ('system_admin','settings.update'),
  ('system_admin','daily_task.manage_self'),

  -- general_manager: same as system_admin but cannot change user roles or system settings
  ('general_manager','project.read'), ('general_manager','project.create'), ('general_manager','project.update'),
  ('general_manager','project.update_any'), ('general_manager','project.change_stage'),
  ('general_manager','project.assign'), ('general_manager','project.archive'),
  ('general_manager','brief.create'), ('general_manager','brief.parse_ai'),
  ('general_manager','deliverable.update'), ('general_manager','deliverable.approve'),
  ('general_manager','revision.start'), ('general_manager','revision.resolve'),
  ('general_manager','client.read'), ('general_manager','client.create'), ('general_manager','client.update'),
  ('general_manager','contact.create'), ('general_manager','contact.update'),
  ('general_manager','quote.create'), ('general_manager','quote.send'),
  ('general_manager','invoice.issue'), ('general_manager','payment.record'),
  ('general_manager','equipment.read'), ('general_manager','equipment.update'),
  ('general_manager','user.read'),
  ('general_manager','email.send'), ('general_manager','whatsapp.send'),
  ('general_manager','audit.read'), ('general_manager','ai.cost_dashboard.read'),
  ('general_manager','daily_task.manage_self'),

  -- project_manager
  ('project_manager','project.read'), ('project_manager','project.create'), ('project_manager','project.update'),
  ('project_manager','project.change_stage'), ('project_manager','project.assign'),
  ('project_manager','brief.create'), ('project_manager','brief.parse_ai'),
  ('project_manager','deliverable.update'), ('project_manager','revision.start'), ('project_manager','revision.resolve'),
  ('project_manager','client.read'), ('project_manager','contact.update'),
  ('project_manager','equipment.read'), ('project_manager','equipment.reserve'),
  ('project_manager','user.read'),
  ('project_manager','email.send'), ('project_manager','whatsapp.send'),
  ('project_manager','daily_task.manage_self'),

  -- account_manager
  ('account_manager','project.read'), ('account_manager','project.create'),
  ('account_manager','client.read'), ('account_manager','client.create'), ('account_manager','client.update'),
  ('account_manager','contact.create'), ('account_manager','contact.update'),
  ('account_manager','quote.create'), ('account_manager','quote.send'),
  ('account_manager','brief.create'),
  ('account_manager','deliverable.approve'),
  ('account_manager','email.send'),
  ('account_manager','user.read'),
  ('account_manager','daily_task.manage_self'),

  -- finance
  ('finance','project.read'),
  ('finance','client.read'),
  ('finance','invoice.issue'), ('finance','invoice.cancel'), ('finance','payment.record'),
  ('finance','quote.create'), ('finance','quote.send'),
  ('finance','audit.read'),
  ('finance','user.read'),
  ('finance','daily_task.manage_self'),

  -- hr
  ('hr','user.read'), ('hr','user.update_self'), ('hr','user.invite'),
  ('hr','audit.read'),
  ('hr','daily_task.manage_self'),

  -- user (base — every employee)
  ('user','project.read'),
  ('user','client.read'),
  ('user','equipment.read'),
  ('user','user.read'), ('user','user.update_self'),
  ('user','daily_task.manage_self')
)
INSERT INTO public.role_default_permissions (role, permission_key)
SELECT role_, key_ FROM role_grants
ON CONFLICT (role, permission_key) DO NOTHING;
