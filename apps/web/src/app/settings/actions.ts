'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { LOCALE_COOKIE, LOCALES } from '@/i18n/request';
import { NOTIFICATION_EVENTS, type ChannelPrefs } from './notif-prefs';

async function currentUserId(): Promise<string> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/settings');
  return user.id;
}

/** Profile + language/region. Notifications moved to updateNotificationPrefs. */
export async function updateSettings(formData: FormData) {
  const userId = await currentUserId();

  const uiLanguage = formData.get('uiLanguage')?.toString() || 'ar';
  const timezone = formData.get('timezone')?.toString() || 'Asia/Riyadh';
  const displayName = formData.get('displayName')?.toString().trim();
  const phoneE164 = formData.get('phoneE164')?.toString().trim() || null;
  const whatsappE164 = formData.get('whatsappE164')?.toString().trim() || null;

  await db.execute(sql`
    UPDATE profiles SET
      ui_language = ${uiLanguage},
      timezone = ${timezone},
      display_name = COALESCE(${displayName}, display_name),
      phone_e164 = ${phoneE164},
      whatsapp_e164 = ${whatsappE164},
      updated_at = now()
    WHERE auth_user_id = ${userId}::uuid
  `);

  // Keep the i18n locale cookie in sync so the chosen language switches the UI.
  if ((LOCALES as readonly string[]).includes(uiLanguage)) {
    const jar = await cookies();
    jar.set(LOCALE_COOKIE, uiLanguage, {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }

  revalidatePath('/', 'layout');
}

/** Per-event × per-channel notification matrix (feeds the unified notif service). */
export async function updateNotificationPrefs(
  channels: Record<string, ChannelPrefs>,
): Promise<{ ok: boolean }> {
  const userId = await currentUserId();

  // Whitelist to known events/channels so the client can't write arbitrary keys.
  const clean: Record<string, ChannelPrefs> = {};
  for (const ev of NOTIFICATION_EVENTS) {
    const c = channels[ev.key];
    clean[ev.key] = {
      inApp: !!c?.inApp,
      email: !!c?.email,
      whatsapp: !!c?.whatsapp,
    };
  }

  await db.execute(sql`
    UPDATE profiles SET
      notification_prefs = ${JSON.stringify({ channels: clean })}::jsonb,
      updated_at = now()
    WHERE auth_user_id = ${userId}::uuid
  `);
  revalidatePath('/settings');
  return { ok: true };
}

/** Change own password (already authenticated). */
export async function changePassword(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) return { ok: false, error: 'كلمة المرور 8 أحرف على الأقل' };
  if (password !== confirm) return { ok: false, error: 'كلمتا المرور غير متطابقتين' };

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'انتهت الجلسة. سجّل الدخول مجدداً.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
