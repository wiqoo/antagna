-- Org-chart module (structure.antagna.me). A single editable tree of the Volt
-- Production org. Public surface: written/read through a no-auth API route that
-- uses the service-role DB connection, so RLS isn't the gate here — the table is
-- intentionally a single shared document.

CREATE TABLE IF NOT EXISTS org_nodes (
  id          text PRIMARY KEY,
  parent_id   text REFERENCES org_nodes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  role        text NOT NULL DEFAULT '',
  dept        text NOT NULL DEFAULT 'production',
  vacant      boolean NOT NULL DEFAULT false,
  position    integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_nodes_parent_idx ON org_nodes(parent_id);

-- Seed the current Volt structure (only when empty, so re-running is safe).
INSERT INTO org_nodes (id, parent_id, name, role, dept, vacant, position)
SELECT * FROM (VALUES
  ('n1',  NULL, 'محمد المالكي', 'Founder & Creative Director',      'leadership', false, 0),
  ('n2',  'n1', 'خالد الغامدي', 'Project Manager',                   'management', false, 0),
  ('n3',  'n1', 'محمد غريب',    'Production Manager / Photographer', 'management', false, 1),
  ('n4',  'n1', 'حسين',         'Financial Manager',                 'finance',    false, 2),
  ('n14', 'n1', 'HR',           'الموارد البشرية',                   'admin',      true,  3),
  ('n15', 'n1', 'Legal',        'الشؤون القانونية',                  'admin',      true,  4),
  ('n5',  'n2', 'عبدالله منصوري','Account Manager (Abu Luka)',       'commercial', false, 0),
  ('n6',  'n2', 'Sales',        'مبيعات',                            'commercial', true,  1),
  ('n7',  'n2', 'Marketing',    'تسويق',                             'commercial', true,  2),
  ('n8',  'n5', 'Videographer', 'مصوّر فيديو',                       'production', true,  0),
  ('n9',  'n3', 'محسن',         'Editor (Mid-level)',                'production', false, 0),
  ('n10', 'n3', 'مساعد',        'Technician',                        'production', false, 1),
  ('n11', 'n3', 'Post-Production Head', 'رئيس ما بعد الإنتاج',       'production', true,  2),
  ('n12', 'n3', 'Videographer', 'مصوّر فيديو',                       'production', true,  3),
  ('n13', 'n4', 'خالد الشهري',  'Accountant',                        'finance',    false, 0)
) AS seed(id, parent_id, name, role, dept, vacant, position)
WHERE NOT EXISTS (SELECT 1 FROM org_nodes);
