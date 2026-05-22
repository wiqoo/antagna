-- Permissions catalog additions for the Email Intelligence layer.
-- Mapped to roles via role_default_permissions so /inbox/suggestions
-- filters who can see / approve / auto-execute / tune per role.

INSERT INTO permissions (key, category, description_ar, risk_level)
VALUES
  ('ai_suggestion.review',       'ai',
   'يقدر يفتح قائمة اقتراحات الـ AI ويشوف اللي معلّق', 'normal'),
  ('ai_suggestion.approve',      'ai',
   'يقدر يعمل approve / reject / edit لاقتراحات الـ AI', 'sensitive'),
  ('ai_suggestion.auto_execute', 'ai',
   'تنفّذ اقتراحات الـ AI تلقائياً لما تتعدّى الـ confidence threshold',
   'sensitive'),
  ('ai_suggestion.tune',         'ai',
   'يعدّل thresholds + executors per suggestion_type', 'sensitive')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_default_permissions (role, permission_key)
VALUES
  ('system_admin',     'ai_suggestion.review'),
  ('system_admin',     'ai_suggestion.approve'),
  ('system_admin',     'ai_suggestion.auto_execute'),
  ('system_admin',     'ai_suggestion.tune'),
  ('general_manager',  'ai_suggestion.review'),
  ('general_manager',  'ai_suggestion.approve'),
  ('general_manager',  'ai_suggestion.auto_execute'),
  ('project_manager',  'ai_suggestion.review'),
  ('project_manager',  'ai_suggestion.approve'),
  ('account_manager',  'ai_suggestion.review'),
  ('account_manager',  'ai_suggestion.approve'),
  ('user',             'ai_suggestion.review')
ON CONFLICT (role, permission_key) DO NOTHING;
