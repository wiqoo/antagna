'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { withActor, db, dailyTasks } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { loadRoutines, riyadhToday, routineSourceKey } from '@/lib/routines';

/**
 * Idempotently materialize today's routine for `profileId`'s position. One
 * daily_tasks row per routine item per day, tagged with
 * source_key='routine:<item_key>:<YYYY-MM-DD>'. Re-running the same day is a
 * no-op (only the missing keys are inserted). The DB has no unique index on
 * (owner_id, source_key), so we read the existing keys first and insert the
 * gap — wrapped in withActor so the audit trigger sees the actor.
 *
 * Gated by daily_task.manage_self (every positioned user holds it). Rendered by
 * the My-Day section now merged into /dashboard.
 */
export async function ensureTodayRoutine(
  profileId: string,
  positionKey: string | null | undefined,
): Promise<void> {
  const items = loadRoutines(positionKey);
  if (items.length === 0) return;

  // The page passes the effective profile id and gates impersonation itself.
  // requirePermissionAction resolves the same effective profile as the acting
  // principal; the equality check is a defensive belt-and-braces so we never
  // write a routine row onto a profile other than the one acting.
  const actorId = await requirePermissionAction('daily_task.manage_self');
  if (actorId !== profileId) return;

  const day = riyadhToday();
  const wantKeys = items.map((it) => routineSourceKey(it.key, day));

  const existing = await db
    .select({ sourceKey: dailyTasks.sourceKey })
    .from(dailyTasks)
    .where(and(eq(dailyTasks.ownerId, actorId), inArray(dailyTasks.sourceKey, wantKeys)));
  const have = new Set(existing.map((r) => r.sourceKey));

  const toInsert = items
    .filter((it) => !have.has(routineSourceKey(it.key, day)))
    .map((it) => ({
      ownerId: actorId,
      title: it.titleAr,
      sourceKey: routineSourceKey(it.key, day),
      // Routine items live for the day; due at end of the Riyadh day.
      dueAt: new Date(`${day}T23:59:59+03:00`),
    }));

  if (toInsert.length === 0) return;

  await withActor(actorId, async (tx) => {
    // ON CONFLICT against the partial unique index (owner_id, source_key) —
    // race-safe if two /dashboard loads materialize the same day concurrently
    // (migration 056). The read above just trims the common no-op case.
    await tx
      .insert(dailyTasks)
      .values(toInsert)
      .onConflictDoNothing({ target: [dailyTasks.ownerId, dailyTasks.sourceKey] });
  });
  // No revalidatePath here: ensureTodayRoutine runs during the /dashboard render
  // (calling revalidatePath mid-render throws "Route used revalidatePath…"). The
  // page reads daily_tasks AFTER this call in the same render, so new rows show
  // immediately. revalidatePath stays in completeTask (a real action).
}

/**
 * Toggle a daily task done/undone. Used by the routine checklist (optimistic on
 * the client). Only the owner can toggle their own rows. Returns {ok} so the
 * client island can confirm / roll back.
 */
export async function completeTask(
  taskId: string,
  done: boolean,
): Promise<{ ok: boolean }> {
  const actorId = await requirePermissionAction('daily_task.manage_self');

  await withActor(actorId, async (tx) => {
    await tx
      .update(dailyTasks)
      .set({
        status: done ? 'completed' : 'pending',
        completedAt: done ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(dailyTasks.id, taskId), eq(dailyTasks.ownerId, actorId)));
  });

  revalidatePath('/dashboard');
  revalidatePath('/tasks');
  return { ok: true };
}
