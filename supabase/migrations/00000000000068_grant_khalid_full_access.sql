-- 068 — grant خالد الغامدي (project_manager) full access via a general_manager hat
--
-- Owner request (2026-06-07): Khalid keeps project_manager as his PRIMARY
-- position ("مدير المشاريع") but ALSO wears a general_manager hat, which carries
-- the '*' wildcard (all permissions) in position_default_permissions.
-- has_permission() resolves across primary profiles.position_key UNION
-- user_position_overrides, so this single override grants every permission
-- without changing his primary identity.
--
-- Mirrors how Mohammed's own full-access hat is granted (migration 049 §5).
-- Remove THIS single row to revert Khalid to a plain project_manager.
--
-- NOTE: already applied live on antagna-v2 (2026-06-07); kept here idempotently
-- so a rebuild-from-migrations preserves the grant.

INSERT INTO public.user_position_overrides (profile_id, position_key, reason)
SELECT id, 'general_manager',
       'Owner grant 2026-06-07: full access (GM wildcard) on top of project_manager primary'
FROM public.profiles
WHERE email = 'khalid@voltsaudi.com'
ON CONFLICT DO NOTHING;
