'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';

// The 16 positions (D-037). `role` params below now carry a position_key —
// permissions resolve via positions, not the legacy `profiles.role`.
const VALID_ROLES = new Set([
  'general_manager', 'creative_director', 'production_director', 'project_manager',
  'account_manager', 'videographer', 'video_editor', 'photo_editor',
  'equipment_technician', 'procurement', 'financial_manager', 'accountant',
  'hr_manager', 'system_admin', 'trainee', 'freelancer',
]);

/** Gate every access-management write on `access.manage` + set the audit actor. */
async function guard(): Promise<string> {
  const pid = await requirePermissionAction('access.manage');
  await db.execute(sql`SELECT set_config('app.acting_as', ${pid}, true)`);
  return pid;
}

/** Assign a profile's PRIMARY position (D-037). `role` carries a position_key.
 *  Multi-hat extras live in user_position_overrides (Phase F UI). */
export async function setUserRole(profileId: string, role: string) {
  if (!VALID_ROLES.has(role)) return;
  await guard();
  await db.execute(sql`UPDATE profiles SET position_key = ${role}, updated_at = now() WHERE id = ${profileId}::uuid`);
  revalidatePath('/admin/access');
}

/** Toggle a position's default grant of a permission (insert if absent, else delete).
 *  `role` carries a position_key — role_default_permissions was renamed to
 *  position_default_permissions in migration 049 (D-037/D-041). */
export async function toggleRoleDefault(role: string, key: string) {
  await guard();
  await db.execute(sql`
    WITH del AS (
      DELETE FROM position_default_permissions
      WHERE position_key = ${role} AND permission_key = ${key}
      RETURNING 1
    )
    INSERT INTO position_default_permissions (position_key, permission_key)
    SELECT ${role}, ${key} WHERE NOT EXISTS (SELECT 1 FROM del)
  `);
  revalidatePath('/admin/access');
}

export async function upsertUserOverride(profileId: string, key: string, granted: boolean, reason?: string) {
  const actor = await guard();
  await db.execute(sql`
    INSERT INTO user_permission_overrides (profile_id, permission_key, granted, reason, granted_by)
    VALUES (${profileId}::uuid, ${key}, ${granted}, ${reason ?? null}, ${actor}::uuid)
    ON CONFLICT (profile_id, permission_key)
    DO UPDATE SET granted = EXCLUDED.granted, reason = EXCLUDED.reason, granted_by = EXCLUDED.granted_by
  `);
  revalidatePath('/admin/access');
}

export async function removeUserOverride(profileId: string, key: string) {
  await guard();
  await db.execute(sql`DELETE FROM user_permission_overrides WHERE profile_id = ${profileId}::uuid AND permission_key = ${key}`);
  revalidatePath('/admin/access');
}

export async function assignCapability(profileId: string, key: string) {
  const actor = await guard();
  await db.execute(sql`
    INSERT INTO user_skills (profile_id, skill_key, added_by)
    VALUES (${profileId}::uuid, ${key}, ${actor}::uuid)
    ON CONFLICT (profile_id, skill_key) DO NOTHING
  `);
  revalidatePath('/admin/access');
}

export async function removeCapability(profileId: string, key: string) {
  await guard();
  await db.execute(sql`DELETE FROM user_skills WHERE profile_id = ${profileId}::uuid AND skill_key = ${key}`);
  revalidatePath('/admin/access');
}
