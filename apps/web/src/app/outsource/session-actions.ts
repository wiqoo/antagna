'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getExternalIdentity, requireVolt } from './auth';
import { notifyInvite } from './notify';

const s = (v: FormDataEntryValue | null, max = 200): string =>
  (v == null ? '' : String(v)).trim().slice(0, max);

export async function login(formData: FormData): Promise<void> {
  const email = s(formData.get('email'), 160).toLowerCase();
  const password = s(formData.get('password'), 200);
  if (!email || !password) redirect('/outsource/login?error=missing');

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/outsource/login?error=bad');

  const id = await getExternalIdentity();
  if (id.role === 'partner') redirect('/outsource/portal');
  if (id.role === 'volt') redirect('/outsource');
  // authenticated but not provisioned for this system
  await supabase.auth.signOut();
  redirect('/outsource/login?error=noaccess');
}

export async function logout(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/outsource/login');
}

/** Volt: generate a fresh invite for the job's partner (link shown on the job). */
export async function createInvite(jobId: string): Promise<void> {
  const me = await requireVolt();
  const rows = (await db.execute(sql`
    SELECT partner_id::text AS "partnerId" FROM external_jobs WHERE id = ${jobId}::uuid
  `)) as unknown as Array<{ partnerId: string | null }>;
  const partnerId = rows[0]?.partnerId;
  if (!partnerId) return;
  const ins = (await db.execute(sql`
    INSERT INTO partner_invites (partner_id, created_by)
    VALUES (${partnerId}::uuid, ${me.profileId ? sql`${me.profileId}::uuid` : sql`NULL`})
    RETURNING token::text AS token
  `)) as unknown as Array<{ token: string }>;
  const pr = (await db.execute(sql`
    SELECT name, contact_email AS "contactEmail" FROM partners WHERE id = ${partnerId}::uuid
  `)) as unknown as Array<{ name: string; contactEmail: string | null }>;
  const token = ins[0]?.token;
  if (token) {
    await notifyInvite({ to: pr[0]?.contactEmail ?? null, partnerName: pr[0]?.name ?? null, token }).catch(() => {});
  }
  revalidatePath(`/outsource/${jobId}`);
}

/** Partner: accept an invite → create their own account + sign in. */
export async function acceptInvite(token: string, formData: FormData): Promise<void> {
  const back = `/outsource/invite/${token}`;
  const rows = (await db.execute(sql`
    SELECT pi.id::text AS "id", pi.partner_id::text AS "partnerId", pi.accepted_at AS "acceptedAt",
           (pi.expires_at < now()) AS "expired"
    FROM partner_invites pi WHERE pi.token = ${token}::uuid
  `)) as unknown as Array<{ id: string; partnerId: string; acceptedAt: string | null; expired: boolean }>;
  const inv = rows[0];
  if (!inv || inv.acceptedAt || inv.expired) redirect(`${back}?error=invalid`);

  const email = s(formData.get('email'), 160).toLowerCase();
  const password = s(formData.get('password'), 200);
  const name = s(formData.get('name'), 120);
  if (!email || password.length < 6) redirect(`${back}?error=weak`);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) redirect(`${back}?error=exists`);

  await db.execute(sql`
    INSERT INTO ext_users (auth_user_id, role, partner_id, display_name)
    VALUES (${data.user.id}::uuid, 'partner', ${inv.partnerId}::uuid, ${name || null})
  `);
  // SECURITY: an auth trigger auto-creates an Antagna profile for every new
  // auth user. A partner must NOT have a profile (that would grant main-app
  // access) — remove it so they exist only as an external partner.
  await db.execute(sql`DELETE FROM profiles WHERE auth_user_id = ${data.user.id}::uuid`);
  await db.execute(sql`UPDATE partner_invites SET accepted_at = now() WHERE id = ${inv.id}::uuid`);

  const supabase = await getSupabaseServerClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect('/outsource/portal');
}
