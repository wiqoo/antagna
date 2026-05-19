'use server';

import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

async function actorId() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [a] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  return a?.id ?? null;
}

export async function markAllNotificationsRead() {
  const id = await actorId();
  if (!id) return;
  await db.execute(sql`
    UPDATE notifications
    SET read_at = now()
    WHERE recipient_id = ${id}::uuid AND read_at IS NULL
  `);
  revalidatePath('/', 'layout');
}

export async function markNotificationRead(notificationId: string) {
  const id = await actorId();
  if (!id) return;
  await db.execute(sql`
    UPDATE notifications
    SET read_at = now()
    WHERE id = ${notificationId}::bigint AND recipient_id = ${id}::uuid
  `);
  revalidatePath('/', 'layout');
}
