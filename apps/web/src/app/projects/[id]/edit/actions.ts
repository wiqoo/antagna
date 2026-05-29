'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { writeActivity } from '@/lib/activity';
import { notify } from '@/lib/notify';
import { requirePermissionAction } from '@/lib/authz';
import { parseNum, parseDate } from '@/lib/parse';

export async function updateProject(projectId: string, formData: FormData) {
  const pid = await requirePermissionAction('project.update');

  const title = formData.get('title')?.toString() || null;
  const titleAr = formData.get('titleAr')?.toString() || null;
  const description = formData.get('description')?.toString() || null;
  const clientId = formData.get('clientId')?.toString() || null;
  const projectType = formData.get('projectType')?.toString() || null;
  const driveFolderUrl = formData.get('driveFolderUrl')?.toString() || null;
  const notes = formData.get('notes')?.toString() || null;

  // Build SET fragments. A column is only touched when its form key is PRESENT,
  // so an absent field leaves the existing value intact (no NULL-wipe). An
  // empty string means an explicit clear → NULL.
  const sets = [
    sql`title = COALESCE(${title}, title)`,
    sql`title_ar = ${titleAr}`,
    sql`description = ${description}`,
    sql`client_id = COALESCE(${clientId}::uuid, client_id)`,
    sql`project_type = COALESCE(${projectType}::project_type, project_type)`,
    sql`drive_folder_url = ${driveFolderUrl}`,
    sql`notes = ${notes}`,
    sql`updated_at = now()`,
  ];

  const setUuidIfPresent = (key: string, col: string) => {
    if (!formData.has(key)) return;
    const raw = formData.get(key)?.toString().trim() || null;
    sets.push(
      sql`${sql.raw(col)} = ${raw ? sql`${raw}::uuid` : sql`NULL`}`,
    );
  };
  setUuidIfPresent('pmId', 'project_manager_id');
  setUuidIfPresent('amId', 'account_manager_id');
  setUuidIfPresent('productionManagerId', 'production_manager_id');

  if (formData.has('contractedValueSar')) {
    const v = parseNum(formData.get('contractedValueSar'));
    sets.push(
      sql`contracted_value_sar = ${v != null ? sql`${v}::numeric` : sql`NULL`}`,
    );
  }
  if (formData.has('deliveryDueAt')) {
    const v = parseDate(formData.get('deliveryDueAt'));
    sets.push(sql`delivery_due_at = ${v ? sql`${v}::timestamptz` : sql`NULL`}`);
  }
  if (formData.has('shootStartsAt')) {
    const v = parseDate(formData.get('shootStartsAt'));
    sets.push(sql`shoot_starts_at = ${v ? sql`${v}::timestamptz` : sql`NULL`}`);
  }
  if (formData.has('shootEndsAt')) {
    const v = parseDate(formData.get('shootEndsAt'));
    sets.push(sql`shoot_ends_at = ${v ? sql`${v}::timestamptz` : sql`NULL`}`);
  }

  await withActor(pid, (tx) =>
    tx.execute(sql`
      UPDATE projects SET ${sql.join(sets, sql`, `)}
      WHERE id = ${projectId}::uuid
    `),
  );

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');
  redirect(`/projects/${projectId}`);
}

export async function addAssignment(projectId: string, formData: FormData) {
  const pid = await requirePermissionAction('project.assign');

  // `assignee` is "p:<profileId>" (team member) or "f:<freelancerId>" (freelancer);
  // externalName is the fallback for an off-system person.
  const assignee = formData.get('assignee')?.toString() || '';
  const externalName = formData.get('externalName')?.toString().trim() || null;
  const profileId = assignee.startsWith('p:') ? assignee.slice(2) : null;
  const freelancerId = assignee.startsWith('f:') ? assignee.slice(2) : null;
  const role = formData.get('role')?.toString();
  const rateSar = parseNum(formData.get('rateSar'));
  const rateUnit = formData.get('rateUnit')?.toString() || null;

  if (!role || (!profileId && !freelancerId && !externalName)) return;

  await withActor(pid, (tx) =>
    tx.execute(sql`
      INSERT INTO project_assignments
        (project_id, profile_id, freelancer_id, external_name, role, rate_sar, rate_unit, created_by)
      VALUES (
        ${projectId}::uuid,
        ${profileId ? sql`${profileId}::uuid` : sql`NULL`},
        ${freelancerId ? sql`${freelancerId}::uuid` : sql`NULL`},
        ${!profileId && !freelancerId ? externalName : null},
        ${role}::project_assignment_role,
        ${rateSar != null ? sql`${rateSar}::numeric` : sql`NULL`},
        ${rateUnit},
        ${pid}::uuid
      )
    `),
  );

  await writeActivity({
    actorId: pid,
    entityType: 'project',
    entityId: projectId,
    projectId,
    action: 'assignment_added',
    summaryAr: `أُسند دور «${role}» إلى المشروع`,
    summaryEn: `Assigned role ${role}`,
    metadata: { role, freelancer: !!freelancerId },
  });

  // Notify the assigned team member (internal profiles only) via the unified service.
  if (profileId) {
    const [pr] = (await db.execute(sql`
      SELECT COALESCE(title_ar, title) AS t FROM projects WHERE id = ${projectId}::uuid
    `)) as unknown as { t: string }[];
    const proj = pr?.t ?? 'مشروع';
    await notify({
      recipientId: profileId,
      event: 'on_assignment',
      content: {
        ar: { title: 'أُسندت إلى مشروع', body: `${proj} — بدور ${role}` },
        en: { title: 'You were assigned to a project', body: `${proj} — as ${role}` },
      },
      linkUrl: `/projects/${projectId}`,
      entityType: 'project',
      entityId: projectId,
    }).catch((e) => console.error('[addAssignment notify]', e));
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function removeAssignment(projectId: string, assignmentId: string) {
  const pid = await requirePermissionAction('project.assign');

  await withActor(pid, (tx) =>
    tx.execute(
      sql`DELETE FROM project_assignments WHERE id = ${assignmentId}::uuid`,
    ),
  );
  await writeActivity({
    actorId: pid,
    entityType: 'project',
    entityId: projectId,
    projectId,
    action: 'assignment_removed',
    summaryAr: 'أُزيل عضو من فريق المشروع',
    summaryEn: 'Removed a project assignment',
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function addProjectTask(projectId: string, formData: FormData) {
  const pid = await requirePermissionAction('project.update');

  const title = formData.get('title')?.toString();
  if (!title) return;
  const assigneeId = formData.get('assigneeId')?.toString() || null;
  const priority = formData.get('priority')?.toString() || 'normal';
  const dueAt = parseDate(formData.get('dueAt'));

  await withActor(pid, (tx) =>
    tx.execute(sql`
      INSERT INTO project_tasks (project_id, title, assignee_id, priority, due_at, created_by)
      VALUES (
        ${projectId}::uuid,
        ${title},
        ${assigneeId ? sql`${assigneeId}::uuid` : sql`NULL`},
        ${priority}::task_priority,
        ${dueAt ? sql`${dueAt}::timestamptz` : sql`NULL`},
        ${pid}::uuid
      )
    `),
  );

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/tasks');
}
