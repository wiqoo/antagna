'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n/request';
import { getRealProfile } from './view-as';

/** Switch the UI language: set the locale cookie (drives next-intl) and persist
 * it to the signed-in user's `profiles.ui_language` so it follows them. */
export async function setLocale(locale: Locale) {
  if (!(LOCALES as readonly string[]).includes(locale)) return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });

  const me = await getRealProfile();
  if (me) {
    await db.execute(
      sql`UPDATE profiles SET ui_language = ${locale}, updated_at = now() WHERE id = ${me.id}::uuid`,
    );
  }

  revalidatePath('/', 'layout');
}
