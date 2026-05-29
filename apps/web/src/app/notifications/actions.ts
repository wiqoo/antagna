'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { getEffectiveProfileId } from '@/lib/authz';

/**
 * Notifications are SELF-OWNED: a row is gated by `recipient_id`, so there is no
 * permission key to check — the actor may only touch their own rows. We resolve
 * the effective (view-as aware) profile id, then mutate inside withActor() so the
 * audit principal (`app.acting_as`) is set on the same pinned connection.
 *
 * Both mutations are scoped `WHERE recipient_id = <actor>` so impersonation /
 * a malformed id can never read or clear someone else's notifications.
 */

export async function markRead(id: string) {
  const pid = await getEffectiveProfileId();
  if (!pid) throw new Error('unauthorized');
  await withActor(pid, (tx) =>
    tx.execute(sql`
      UPDATE notifications
      SET read_at = now()
      WHERE id = ${id}::bigint AND recipient_id = ${pid}::uuid AND read_at IS NULL
    `),
  );
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
}

export async function markUnread(id: string) {
  const pid = await getEffectiveProfileId();
  if (!pid) throw new Error('unauthorized');
  await withActor(pid, (tx) =>
    tx.execute(sql`
      UPDATE notifications
      SET read_at = NULL
      WHERE id = ${id}::bigint AND recipient_id = ${pid}::uuid
    `),
  );
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
}

export async function markAllRead() {
  const pid = await getEffectiveProfileId();
  if (!pid) throw new Error('unauthorized');
  await withActor(pid, (tx) =>
    tx.execute(sql`
      UPDATE notifications
      SET read_at = now()
      WHERE recipient_id = ${pid}::uuid AND read_at IS NULL
    `),
  );
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
}
