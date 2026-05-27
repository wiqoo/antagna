-- A4: permission gating the /admin/automation editor (alert rules + KPI thresholds).
-- compute_sql is intentionally NOT editable from the UI (it is executed SQL).
INSERT INTO permissions (key, category, description_ar, description_en, risk_level)
VALUES ('automation.manage', 'system',
        'إدارة قواعد التنبيهات ومؤشرات الأداء',
        'Manage alert rules and KPI thresholds', 'high')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_default_permissions (role, permission_key)
VALUES ('system_admin', 'automation.manage'),
       ('general_manager', 'automation.manage')
ON CONFLICT (role, permission_key) DO NOTHING;
