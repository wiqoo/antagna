/**
 * Admin auth guards. The DB has `is_admin_caller()` (role ∈ system_admin /
 * system_manager) but that runs as SQL against the auth session. Server
 * routes / pages need a TypeScript check that hits the profiles table.
 */
import { db, profiles } from '@antagna/db';
import { eq } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';
import { getSupabaseServerClient } from './supabase/server';

const ADMIN_ROLES = new Set(['system_admin', 'system_manager']);

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
 * Doesn't redirect — caller decides what to do.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [row] = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      displayName: profiles.displayName,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  if (!row || !ADMIN_ROLES.has(row.role)) return null;
  return { user, profile: row };
}
