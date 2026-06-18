import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export interface Owner {
  profileId: string;
  displayName: string | null;
}

/**
 * The personal system is single-user + private-per-account: any authenticated
 * Antagna profile gets their own owner-scoped space. /me isn't in the public
 * allowlist, so the middleware already bounced logged-out users to /login.
 */
export async function requireOwner(): Promise<Owner> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/me');
  const rows = (await db.execute(sql`
    SELECT id::text AS "profileId", display_name AS "displayName"
    FROM profiles WHERE auth_user_id = ${user.id}::uuid LIMIT 1
  `)) as unknown as Array<{ profileId: string; displayName: string | null }>;
  const p = rows[0];
  if (!p?.profileId) redirect('/login?next=/me');
  return { profileId: p.profileId, displayName: p.displayName };
}
