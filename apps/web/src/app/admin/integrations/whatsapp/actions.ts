'use server';

import { revalidatePath } from 'next/cache';
import { db, profiles } from '@antagna/db';
import { eq } from 'drizzle-orm';
import { getAdminUser } from '@/lib/auth-admin';

export async function linkSenderToProfile(
  fromE164: string,
  profileId: string,
) {
  const admin = await getAdminUser();
  if (!admin) throw new Error('forbidden');

  if (!fromE164.startsWith('+') && !fromE164.startsWith('lid:')) {
    throw new Error('invalid sender format');
  }

  // Set whatsapp_e164 on the chosen profile.
  await db
    .update(profiles)
    .set({ whatsappE164: fromE164, updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  revalidatePath('/admin/integrations/whatsapp');
}
