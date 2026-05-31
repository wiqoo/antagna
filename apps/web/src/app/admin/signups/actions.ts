'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';

/**
 * Resend-invite STUB. Email dispatch is category-5 (visible to other humans) +
 * HELD pending explicit Mohammed approval — same posture as the original invite
 * action (admin/invite-user/actions.ts). We do NOT call
 * supabase.auth.admin.inviteUserByEmail here. The action only verifies the
 * target is still a pending (status='invited') profile and bounces back with a
 * "held" notice so the UI reflects intent without sending anything.
 */
export async function resendInviteAction(formData: FormData) {
  await requirePermissionAction('user.invite');

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/admin/signups?error=' + encodeURIComponent('معرّف غير صالح'));

  const rows = (await db.execute<{ email: string; display_name: string; status: string }>(
    sql`SELECT email, display_name, status FROM profiles WHERE id = ${id}::uuid LIMIT 1`,
  )) as unknown as { email: string; display_name: string; status: string }[];

  const target = rows[0];
  if (!target) {
    redirect('/admin/signups?error=' + encodeURIComponent('المستخدم غير موجود'));
  }
  if (target.status !== 'invited') {
    redirect('/admin/signups?error=' + encodeURIComponent('هذا المستخدم ليس بانتظار الانضمام'));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TODO(category-5 — HELD for explicit Mohammed approval):
  //   const admin = getSupabaseAdminClient();
  //   await admin.auth.admin.inviteUserByEmail(target.email, {
  //     redirectTo: `${siteOrigin}/auth/callback?next=/dashboard`,
  //     data: { full_name: target.display_name },
  //   });
  // Until approved, no email leaves the system.
  // ──────────────────────────────────────────────────────────────────────────

  revalidatePath('/admin/signups');
  redirect(
    '/admin/signups?ok=' +
      encodeURIComponent(`إعادة الدعوة معدّة لـ ${target.display_name} — الإرسال مُعطّل (بانتظار الموافقة).`),
  );
}

/**
 * Approve a self-registered account: flip status 'invited' → 'active' so the
 * user can access the app. Open registration + admin approval — the user
 * already set their own password at signup, so no email/invite is sent (not
 * category-5). Gated on user.invite.
 */
export async function approveSignupAction(formData: FormData) {
  await requirePermissionAction('user.invite');

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/admin/signups?error=' + encodeURIComponent('معرّف غير صالح'));

  const rows = (await db.execute<{ email: string; display_name: string; status: string }>(
    sql`SELECT email, display_name, status FROM profiles WHERE id = ${id}::uuid LIMIT 1`,
  )) as unknown as { email: string; display_name: string; status: string }[];

  const target = rows[0];
  if (!target) {
    redirect('/admin/signups?error=' + encodeURIComponent('المستخدم غير موجود'));
  }
  if (target.status !== 'invited') {
    redirect('/admin/signups?error=' + encodeURIComponent('هذا المستخدم ليس بانتظار الموافقة'));
  }

  await db.execute(sql`
    UPDATE profiles SET status = 'active', updated_at = now()
    WHERE id = ${id}::uuid AND status = 'invited'
  `);

  revalidatePath('/admin/signups');
  redirect(
    '/admin/signups?ok=' + encodeURIComponent(`تم تفعيل حساب ${target.display_name}.`),
  );
}
