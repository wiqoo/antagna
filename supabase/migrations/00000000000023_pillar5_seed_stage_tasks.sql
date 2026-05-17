-- Pillar 5 §3.1 — seed stage_task_templates (canonical task list per stage).

INSERT INTO public.stage_task_templates (stage, title_ar, title_en, assignee_role_hint, due_offset_days, is_mandatory, position) VALUES
  -- brief
  ('brief', 'مراجعة اكتمال البريف',           'Verify brief completeness',         'project_manager',  1, true,  10),
  ('brief', 'جدولة اجتماع المراجعة الداخلية',  'Schedule internal review meeting',  'project_manager',  2, false, 20),
  ('brief', 'إرسال تأكيد استلام للعميل',       'Send acknowledgement to client',    'account_manager',  1, true,  30),

  -- quoted
  ('quoted', 'تجهيز ورقة التكاليف',            'Prepare cost sheet',                'project_manager',  2, true,  10),
  ('quoted', 'موافقة داخلية (PM + GM)',         'Internal sign-off (PM + GM)',       'production_manager', 3, true, 20),
  ('quoted', 'إرسال عرض السعر للعميل',          'Send quote to client',              'account_manager',  3, true,  30),

  -- approved
  ('approved', 'استلام أمر التشغيل (PO)',       'Receive PO',                        'account_manager',  3, true,  10),
  ('approved', 'تأكيد التواريخ',                'Confirm dates',                     'project_manager',  2, true,  20),
  ('approved', 'تحديد الفريق والمعدّات والمواقع','Lock crew + equipment + locations', 'production_manager', 5, true, 30),

  -- planning
  ('planning', 'اجتماع بريف الفريق',            'Crew briefing',                     'production_manager', 2, true,  10),
  ('planning', 'استكشاف الموقع',                'Location scout',                    'production_manager', 5, false, 20),
  ('planning', 'تثبيت قائمة المعدّات',          'Equipment list final',              'production_manager', 4, true,  30),
  ('planning', 'تأكيد السفر والإقامة',          'Travel + accommodation',            'project_manager',    7, false, 40),
  ('planning', 'استخراج التصاريح',              'Permits',                           'project_manager',    7, false, 50),
  ('planning', 'اجتماع ما قبل الإنتاج',         'Pre-production meeting',            'production_manager', 1, true,  60),

  -- shooting
  ('shooting', 'جدول التصوير اليومي (Call sheet)', 'Daily call sheet',                'production_manager', 0, true,  10),
  ('shooting', 'سحب وإرجاع المعدّات',           'Equipment check-in/out',            'shooter_lead',       0, true,  20),
  ('shooting', 'تصوير BTS',                     'BTS captured',                      'shooter',            0, false, 30),
  ('shooting', 'نسخ احتياطي للفوتيج يوميًا',     'Footage backed up daily',           'shooter_lead',       0, true,  40),

  -- editing
  ('editing', 'تحضير السيليكتس',                'Selects',                           'editor_lead',        3, true,  10),
  ('editing', 'كت أول',                          'First cut',                         'editor',             7, true,  20),
  ('editing', 'كولر جريد',                       'Color grade',                       'colorist',           3, false, 30),
  ('editing', 'هندسة صوت',                       'Sound mix',                         'sound_engineer',     3, false, 40),
  ('editing', 'تصدير الماستر',                  'Master export',                     'editor_lead',        1, true,  50),

  -- review
  ('review', 'إرسال للعميل',                    'Submit to client',                  'account_manager',    1, true,  10),
  ('review', 'متابعة جولات التعديل',            'Track feedback rounds',             'account_manager',    7, false, 20),
  ('review', 'تطبيق التعديلات',                 'Apply revisions',                   'editor',             5, false, 30),

  -- delivered
  ('delivered', 'التسليم النهائي',              'Final delivery',                    'project_manager',    1, true,  10),
  ('delivered', 'إنشاء الفاتورة في Dafterah',    'Generate invoice in Dafterah',      'account_manager',    2, true,  20),
  ('delivered', 'تحضير الأرشيف',                'Project archive prep',              'project_manager',    7, false, 30)
ON CONFLICT DO NOTHING;
