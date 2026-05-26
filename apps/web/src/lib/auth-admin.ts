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

// Coarse admin gate for /admin. Fine-grained checks use lib/authz.ts `can()`.
// (general_manager is the senior business admin; the old 'system_manager' role never existed.)
const ADMIN_ROLES = new Set(['system_admin', 'general_manager']);

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
  if (!current || !ADMIN_ROLES.has(current.role)) return null;
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
