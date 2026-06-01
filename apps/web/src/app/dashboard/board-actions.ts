'use server';

import { revalidatePath } from 'next/cache';
import { requirePermissionAction } from '@/lib/authz';
import { refreshBoardCache } from './board';

/** Force-recompute the signed-in user's dashboard board cache (manual refresh).
 *  The board normally serves from a 20-min cache; this recomputes immediately. */
export async function refreshDashboardBoard(): Promise<{ ok: boolean }> {
  const actorId = await requirePermissionAction('daily_task.manage_self');
  await refreshBoardCache(actorId).catch((e) => console.error('[board-refresh]', e));
  revalidatePath('/dashboard');
  return { ok: true };
}
