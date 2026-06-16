import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export type ExtRole = 'volt' | 'partner' | null;

export interface ExtIdentity {
  authUserId: string | null;
  role: ExtRole;
  partnerId: string | null;
  profileId: string | null;
  displayName: string | null;
  email: string | null;
}

/**
 * Resolve who is hitting the external module.
 *  - Volt staff  → identified by having an Antagna `profiles` row.
 *  - Partner     → an `ext_users` row with role='partner' (and NO profile).
 *  - null role   → authenticated but not provisioned (deny).
 */
export async function getExternalIdentity(): Promise<ExtIdentity> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authUserId: null, role: null, partnerId: null, profileId: null, displayName: null, email: null };

  const rows = (await db.execute(sql`
    SELECT
      (SELECT id::text FROM profiles WHERE auth_user_id = ${user.id}::uuid LIMIT 1) AS "profileId",
      (SELECT display_name FROM profiles WHERE auth_user_id = ${user.id}::uuid LIMIT 1) AS "profileName",
      (SELECT partner_id::text FROM ext_users WHERE auth_user_id = ${user.id}::uuid AND role='partner' LIMIT 1) AS "partnerId",
      (SELECT display_name FROM ext_users WHERE auth_user_id = ${user.id}::uuid LIMIT 1) AS "extName"
  `)) as unknown as Array<{ profileId: string | null; profileName: string | null; partnerId: string | null; extName: string | null }>;
  const r = rows[0] ?? { profileId: null, profileName: null, partnerId: null, extName: null };

  if (r.profileId) {
    return { authUserId: user.id, role: 'volt', partnerId: null, profileId: r.profileId, displayName: r.profileName, email: user.email ?? null };
  }
  if (r.partnerId) {
    return { authUserId: user.id, role: 'partner', partnerId: r.partnerId, profileId: null, displayName: r.extName, email: user.email ?? null };
  }
  return { authUserId: user.id, role: null, partnerId: null, profileId: null, displayName: null, email: user.email ?? null };
}

/** Gate a Volt-management page. Redirects partners to their portal, others to login. */
export async function requireVolt(): Promise<ExtIdentity> {
  const id = await getExternalIdentity();
  if (id.role === 'volt') return id;
  if (id.role === 'partner') redirect('/external/portal');
  redirect('/external/login');
}

/** Gate the partner portal. Redirects Volt staff to management, others to login. */
export async function requirePartner(): Promise<ExtIdentity & { partnerId: string }> {
  const id = await getExternalIdentity();
  if (id.role === 'partner' && id.partnerId) return id as ExtIdentity & { partnerId: string };
  if (id.role === 'volt') redirect('/external');
  redirect('/external/login');
}
