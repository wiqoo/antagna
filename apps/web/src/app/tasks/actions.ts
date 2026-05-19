'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { db, profiles, projectTasks, dailyTasks } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function setTaskStatus(
  source: 'project' | 'daily',
  taskId: string,
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled',
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  if (actor) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${actor.id}, true)`);
  }

  const completedAt = status === 'completed' ? new Date() : null;

  if (source === 'project') {
    await db
      .update(projectTasks)
      .set({ status, completedAt, updatedAt: new Date() })
      .where(eq(projectTasks.id, taskId));
  } else {
    await db
      .update(dailyTasks)
      .set({ status, completedAt, updatedAt: new Date() })
      .where(eq(dailyTasks.id, taskId));
  }

  revalidatePath('/tasks');
  return { ok: true };
}

export async function createDailyTask(formData: FormData) {
  const title = formData.get('title')?.toString().trim();
  if (!title) return;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (!actor) return;

  const dueAtStr = formData.get('dueAt')?.toString();
  const priority = (formData.get('priority')?.toString() ?? 'normal') as
    | 'low'
    | 'normal'
    | 'high'
    | 'urgent';

  await db.insert(dailyTasks).values({
    ownerId: actor.id,
    title,
    priority,
    dueAt: dueAtStr ? new Date(dueAtStr) : null,
  });

  revalidatePath('/tasks');
}
