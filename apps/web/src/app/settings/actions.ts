'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { LOCALE_COOKIE, LOCALES } from '@/i18n/request';

export async function updateSettings(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/settings');

  const uiLanguage = formData.get('uiLanguage')?.toString() || 'ar';
  const timezone = formData.get('timezone')?.toString() || 'Asia/Riyadh';
  const displayName = formData.get('displayName')?.toString().trim();
  const phoneE164 = formData.get('phoneE164')?.toString().trim() || null;
  const whatsappE164 = formData.get('whatsappE164')?.toString().trim() || null;

  // Notification prefs
  const notifyEmailDigest = formData.get('notifyEmailDigest') === 'on';
  const notifyOnAssignment = formData.get('notifyOnAssignment') === 'on';
  const notifyOnComment = formData.get('notifyOnComment') === 'on';
  const notifyOnDeadline = formData.get('notifyOnDeadline') === 'on';

  await db.execute(sql`
    UPDATE profiles SET
      ui_language = ${uiLanguage},
      timezone = ${timezone},
      display_name = COALESCE(${displayName}, display_name),
      phone_e164 = ${phoneE164},
      whatsapp_e164 = ${whatsappE164},
      notification_prefs = ${JSON.stringify({
        email_digest: notifyEmailDigest,
        on_assignment: notifyOnAssignment,
        on_comment: notifyOnComment,
        on_deadline: notifyOnDeadline,
      })}::jsonb,
      updated_at = now()
    WHERE auth_user_id = ${user.id}::uuid
  `);

  // Keep the i18n locale cookie in sync so the chosen language switches the UI.
  if ((LOCALES as readonly string[]).includes(uiLanguage)) {
    const jar = await cookies();
    jar.set(LOCALE_COOKIE, uiLanguage, {
      httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/',
    });
  }

  revalidatePath('/', 'layout');
  void profiles;
  void eq;
}
