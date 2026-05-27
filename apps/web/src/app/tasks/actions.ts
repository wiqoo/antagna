'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { db, profiles, projectTasks, dailyTasks } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { writeActivity } from '@/lib/activity';

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

  let projectId: string | null = null;
  if (source === 'project') {
    const [row] = await db
      .update(projectTasks)
      .set({ status, completedAt, updatedAt: new Date() })
      .where(eq(projectTasks.id, taskId))
      .returning({ projectId: projectTasks.projectId });
    projectId = row?.projectId ?? null;
  } else {
    await db
      .update(dailyTasks)
      .set({ status, completedAt, updatedAt: new Date() })
      .where(eq(dailyTasks.id, taskId));
  }

  await writeActivity({
    actorId: actor?.id ?? null,
    entityType: 'task',
    entityId: taskId,
    projectId,
    action: 'task_status',
    summaryAr: `تغيّرت حالة مهمة إلى «${status}»`,
    summaryEn: `Task status → ${status}`,
    metadata: { status, source },
  });

  revalidatePath('/tasks');
  if (projectId) revalidatePath(`/projects/${projectId}`);
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

  const [row] = await db
    .insert(dailyTasks)
    .values({
      ownerId: actor.id,
      title,
      priority,
      dueAt: dueAtStr ? new Date(dueAtStr) : null,
    })
    .returning({ id: dailyTasks.id });

  await writeActivity({
    actorId: actor.id,
    entityType: 'task',
    entityId: row?.id ?? null,
    action: 'task_created',
    summaryAr: `مهمة يومية جديدة: ${title}`,
    summaryEn: `New daily task: ${title}`,
    metadata: { priority },
  });

  revalidatePath('/tasks');
}
