'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';

const VALID_ROLES = new Set([
  'system_admin', 'general_manager', 'project_manager', 'account_manager', 'hr', 'finance', 'user',
]);

/** Gate every access-management write on `access.manage` + set the audit actor. */
async function guard(): Promise<string> {
  const pid = await requirePermissionAction('access.manage');
  await db.execute(sql`SELECT set_config('app.acting_as', ${pid}, true)`);
  return pid;
}

export async function setUserRole(profileId: string, role: string) {
  if (!VALID_ROLES.has(role)) return;
  await guard();
  await db.execute(sql`UPDATE profiles SET role = ${role}, updated_at = now() WHERE id = ${profileId}::uuid`);
  revalidatePath('/admin/access');
}

/** Toggle a role's default grant of a permission (insert if absent, else delete). */
export async function toggleRoleDefault(role: string, key: string) {
  await guard();
  await db.execute(sql`
    WITH del AS (
      DELETE FROM role_default_permissions
      WHERE role = ${role} AND permission_key = ${key}
      RETURNING 1
    )
    INSERT INTO role_default_permissions (role, permission_key)
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
    INSERT INTO user_capabilities (profile_id, capability_key, added_by)
    VALUES (${profileId}::uuid, ${key}, ${actor}::uuid)
    ON CONFLICT (profile_id, capability_key) DO NOTHING
  `);
  revalidatePath('/admin/access');
}

export async function removeCapability(profileId: string, key: string) {
  await guard();
  await db.execute(sql`DELETE FROM user_capabilities WHERE profile_id = ${profileId}::uuid AND capability_key = ${key}`);
  revalidatePath('/admin/access');
}
