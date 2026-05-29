'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';

/**
 * Phase F — invite-only user creation (D-040).
 *
 * Gated on `user.invite` (held by general_manager, hr_manager, system_admin —
 * migration 049). Creates the `profiles` row with the chosen `position_key`
 * and `status='invited'` so the permission graph resolves immediately, BEFORE
 * the person ever signs in. The actual auth invite email is STUBBED — see the
 * TODO below. We deliberately do NOT call supabase.auth.admin.inviteUserByEmail
 * here: email dispatch is held for explicit Mohammed approval (category-5).
 */

// The 16 positions (D-037). Mirror of /admin/access VALID_ROLES — both carry a
// position_key, not the legacy profiles.role.
const VALID_POSITIONS = new Set([
  'general_manager', 'creative_director', 'production_director', 'project_manager',
  'account_manager', 'videographer', 'video_editor', 'photo_editor',
  'equipment_technician', 'procurement', 'financial_manager', 'accountant',
  'hr_manager', 'system_admin', 'trainee', 'freelancer',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bounce(message: string): never {
  redirect(`/admin/invite-user?error=${encodeURIComponent(message)}`);
}

export async function inviteUserAction(formData: FormData) {
  // Gate + audit actor (same convention as /admin/access).
  const actor = await requirePermissionAction('user.invite');
  await db.execute(sql`SELECT set_config('app.acting_as', ${actor}, true)`);

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const positionKey = String(formData.get('position_key') ?? '').trim();
  const displayName = String(formData.get('display_name') ?? '').trim();

  if (!email || !positionKey || !displayName) {
    bounce('جميع الحقول مطلوبة');
  }
  if (!EMAIL_RE.test(email)) {
    bounce('البريد الإلكتروني غير صالح');
  }
  if (!VALID_POSITIONS.has(positionKey)) {
    bounce('المنصب غير صالح');
  }

  // Reject duplicates up front for a clean message (email is UNIQUE anyway).
  const existing = (await db.execute<{ id: string }>(
    sql`SELECT id FROM profiles WHERE lower(email) = ${email} LIMIT 1`,
  )) as unknown as { id: string }[];
  if (existing.length > 0) {
    bounce('هذا البريد مسجّل بالفعل');
  }

  // Create the profile with position assigned at invite time (D-040) and
  // status='invited' (added in migration 051). No auth_user_id yet — it gets
  // linked when the invitee first authenticates with this email.
  // `role` stays the legacy default 'user' (retired in Phase G); the permission
  // graph resolves via position_key.
  await db.execute(sql`
    INSERT INTO profiles (email, display_name, position_key, status)
    VALUES (${email}, ${displayName}, ${positionKey}, 'invited'::person_status)
  `);

  // ──────────────────────────────────────────────────────────────────────────
  // TODO(Phase F · category-5 — HELD for explicit Mohammed approval):
  // Send the actual invitation email. Do NOT enable until approved.
  //
  //   const admin = getSupabaseAdminClient(); // service-role
  //   await admin.auth.admin.inviteUserByEmail(email, {
  //     redirectTo: `${siteOrigin}/auth/callback?next=/dashboard`,
  //     data: { full_name: displayName },
  //   });
  //
  // When enabled, also reconcile the resulting auth.users.id back onto this
  // profile's auth_user_id (the on_signup trigger is bypassed for invites).
  // ──────────────────────────────────────────────────────────────────────────

  revalidatePath('/admin');
  revalidatePath('/admin/invite-user');
  redirect(
    `/admin/invite-user?ok=${encodeURIComponent(
      `تم إنشاء دعوة ${displayName}. إرسال البريد مُعطّل مؤقتاً (بانتظار الموافقة).`,
    )}`,
  );
}
