/**
 * Admin-only "View as" impersonation.
 *
 * A cookie (antagna_view_as = <profile.id>) selects an alternate profile to
 * see the app as. Resolution happens server-side:
 *
 *   getRealProfile()      → always the actually-logged-in Mohammed
 *   getCurrentProfile()   → impersonated if cookie set AND real user is admin
 *
 * Permission helpers (getAdminUser, etc.) use getCurrentProfile so the
 * effective role flips when viewing as a regular user. That's the point —
 * test what each role can see/do.
 *
 * Mohammed can always switch back because the View-As bar in the Shell uses
 * getRealProfile() to decide whether to render.
 */
import { cookies } from 'next/headers';
import { db, profiles } from '@antagna/db';
import { eq } from 'drizzle-orm';
import { getSupabaseServerClient } from './supabase/server';

export const VIEW_AS_COOKIE = 'antagna_view_as';

const ADMIN_ROLES = new Set(['system_admin', 'general_manager']);

export interface CurrentProfile {
  id: string;
  email: string;
  displayName: string;
  displayNameEn: string | null;
  role: string;
  isImpersonating: boolean;       // true when current ≠ real
  realProfileId: string;          // Mohammed's actual id, even when impersonating
}

/**
 * The actually-signed-in profile. Never honors view-as. Use for permissions
 * that must NOT be impersonatable (e.g., showing the View-As bar itself).
 */
export async function getRealProfile(): Promise<{
  id: string;
  email: string;
  displayName: string;
  role: string;
} | null> {
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

  return row ?? null;
}

/**
 * The effective profile — impersonated if a valid view-as cookie is set and
 * the real user is admin.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const real = await getRealProfile();
  if (!real) return null;

  // Only admins can impersonate.
  if (!ADMIN_ROLES.has(real.role)) {
    return {
      ...real,
      displayNameEn: null,
      isImpersonating: false,
      realProfileId: real.id,
    };
  }

  const store = await cookies();
  const targetId = store.get(VIEW_AS_COOKIE)?.value;
  if (!targetId || targetId === real.id) {
    return {
      ...real,
      displayNameEn: null,
      isImpersonating: false,
      realProfileId: real.id,
    };
  }

  // Resolve target profile.
  const [target] = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      displayName: profiles.displayName,
      displayNameEn: profiles.displayNameEn,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.id, targetId))
    .limit(1);

  if (!target) {
    return {
      ...real,
      displayNameEn: null,
      isImpersonating: false,
      realProfileId: real.id,
    };
  }

  return {
    ...target,
    isImpersonating: true,
    realProfileId: real.id,
  };
}

/**
 * For the dropdown: list every active profile sorted by role tier.
 */
export async function listImpersonatableProfiles(): Promise<
  {
    id: string;
    displayName: string;
    displayNameEn: string | null;
    role: string;
  }[]
> {
  const rows = await db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      displayNameEn: profiles.displayNameEn,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.status, 'active'));

  // Sort by role tier then name.
  const tier = (r: string) =>
    r === 'system_admin'
      ? 1
      : r === 'general_manager'
        ? 2
        : r === 'project_manager'
          ? 3
          : r === 'account_manager'
            ? 4
            : r === 'hr'
              ? 5
              : r === 'finance'
                ? 6
                : 7;
  return rows.sort(
    (a, b) =>
      tier(a.role) - tier(b.role) ||
      a.displayName.localeCompare(b.displayName, 'ar'),
  );
}
