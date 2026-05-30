/**
 * Admin auth guards. The DB has `is_admin_caller()` (role ∈ system_admin /
 * system_manager) but that runs as SQL against the auth session. Server
 * routes / pages need a TypeScript check that hits the profiles table.
 *
 * Honors the View-As impersonation cookie: when an admin views the app as a
 * non-admin profile, admin pages correctly lock them out (so they can test
 * what a regular user sees). The View-As bar in the Shell renders against
 * the REAL profile, so switching back is always one click away.
 */
import type { User } from '@supabase/supabase-js';
import { getSupabaseServerClient } from './supabase/server';
import { getCurrentProfile } from './view-as';
import { can } from './authz';

// Coarse admin gate for /admin. Fine-grained checks use lib/authz.ts `can()`.
// (general_manager is the senior business admin; the old 'system_manager' role never existed.)
//
// Migrating off legacy profiles.role to the position-permission model (L9):
// the real gate for admin surfaces is the `access.manage` permission. We OR it
// with the legacy role set so the migration can't lock out existing admins —
// either signal (the new permission OR the old role) admits the user.
const ADMIN_ROLES = new Set(['system_admin', 'general_manager']);
const ADMIN_PERMISSION = 'access.manage';

export interface AdminUser {
  user: User;
  profile: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
}

/**
 * Returns the admin user + their profile, or null if not signed in / not admin.
 * Honors view-as: if Mohammed is impersonating a non-admin, returns null.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const current = await getCurrentProfile();
  if (!current) return null;
  // Pass on EITHER the new `access.manage` permission OR the legacy admin role.
  // `can()` is view-as aware (resolves the effective profile), matching the old
  // getCurrentProfile()-based role check so impersonation still locks out.
  const allowed =
    ADMIN_ROLES.has(current.role) || (await can(ADMIN_PERMISSION));
  if (!allowed) return null;
  return {
    user,
    profile: {
      id: current.id,
      email: current.email,
      displayName: current.displayName,
      role: current.role,
    },
  };
}
