'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { withActor, projectTasks, dailyTasks } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

export async function setTaskStatus(
  source: 'project' | 'daily',
  taskId: string,
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled',
) {
  // Authz (audit fix): every positioned user holds daily_task.manage_self; the
  // mutation runs inside withActor so the audit trigger sees the actor.
  const actorId = await requirePermissionAction('daily_task.manage_self');

  const completedAt = status === 'completed' ? new Date() : null;

  const projectId = await withActor(actorId, async (tx) => {
    if (source === 'project') {
      const [row] = await tx
        .update(projectTasks)
        .set({ status, completedAt, updatedAt: new Date() })
        .where(eq(projectTasks.id, taskId))
        .returning({ projectId: projectTasks.projectId });
      return row?.projectId ?? null;
    }
    await tx
      .update(dailyTasks)
      .set({ status, completedAt, updatedAt: new Date() })
      .where(eq(dailyTasks.id, taskId));
    return null;
  });

  await writeActivity({
    actorId,
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

  const actorId = await requirePermissionAction('daily_task.manage_self');

  const dueAtStr = formData.get('dueAt')?.toString();
  const priority = (formData.get('priority')?.toString() ?? 'normal') as
    | 'low'
    | 'normal'
    | 'high'
    | 'urgent';

  const row = await withActor(actorId, async (tx) => {
    const [r] = await tx
      .insert(dailyTasks)
      .values({
        ownerId: actorId,
        title,
        priority,
        dueAt: dueAtStr ? new Date(dueAtStr) : null,
      })
      .returning({ id: dailyTasks.id });
    return r;
  });

  await writeActivity({
    actorId,
    entityType: 'task',
    entityId: row?.id ?? null,
    action: 'task_created',
    summaryAr: `مهمة يومية جديدة: ${title}`,
    summaryEn: `New daily task: ${title}`,
    metadata: { priority },
  });

  revalidatePath('/tasks');
}
