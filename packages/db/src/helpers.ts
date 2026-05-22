/**
 * Cross-package helpers that depend on the db client + drizzle.
 * Lives in @antagna/db so consumers don't need to take a direct
 * drizzle-orm dep just to do common lookups.
 */
import { eq } from 'drizzle-orm';
import { db } from './client';
import { profiles } from './schema/people';

/**
 * Resolve a supabase auth.users.id to its profiles.id.
 * Returns null if no profile is linked to that auth user.
 *
 * Most application tables FK their user_id columns to profiles.id, NOT
 * to auth.users.id. Callers that only have an auth user id (from
 * `supabase.auth.getUser()`) must run this first before inserting.
 */
export async function resolveProfileIdByAuthUser(
  authUserId: string,
): Promise<string | null> {
  try {
    const rows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.authUserId, authUserId))
      .limit(1);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}
