-- A2: permission gating the /admin/access role+permission+capability manager.
-- (Everything else reuses existing keys, e.g. ai_suggestion.approve, user.update_role.)
INSERT INTO permissions (key, category, description_ar, description_en, risk_level)
VALUES ('access.manage', 'system',
        'إدارة الأدوار والصلاحيات والقدرات',
        'Manage roles, permissions and capabilities', 'high')
ON CONFLICT (key) DO NOTHING;

-- system_admin already passes via the has_permission bypass; granting it
-- explicitly keeps the role×permission matrix honest.
INSERT INTO role_default_permissions (role, permission_key)
VALUES ('system_admin', 'access.manage')
ON CONFLICT (role, permission_key) DO NOTHING;
