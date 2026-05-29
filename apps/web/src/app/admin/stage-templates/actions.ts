'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';
import { TEMPLATE_STAGES, ASSIGNEE_ROLES } from './constants';

/**
 * stage_task_templates CRUD — admin only (access.manage). These templates spawn
 * the default task checklist when a project enters a given stage.
 * Columns: stage (project_stage enum), title_ar, title_en, description,
 * assignee_role_hint (project_assignment_role enum | null), due_offset_days,
 * is_mandatory, position, active.
 *
 * Writes run inside withActor so the audit trigger sees the principal on the
 * same pinned (transaction-pooler) connection.
 */

function txt(v: FormDataEntryValue | null): string | null {
  const s = v?.toString().trim();
  return s ? s : null;
}

function bool(v: FormDataEntryValue | null): boolean {
  return v === 'on' || v === 'true' || v === '1';
}

function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = v?.toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function validStage(v: FormDataEntryValue | null): string {
  const s = txt(v);
  if (!s || !(TEMPLATE_STAGES as readonly string[]).includes(s))
    throw new Error('invalid stage');
  return s;
}

function roleHint(v: FormDataEntryValue | null): string | null {
  const s = txt(v);
  if (!s) return null;
  return (ASSIGNEE_ROLES as readonly string[]).includes(s) ? s : null;
}

export async function createStageTemplate(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const stage = validStage(formData.get('stage'));
  const titleAr = txt(formData.get('titleAr'));
  const titleEn = txt(formData.get('titleEn'));
  const description = txt(formData.get('description'));
  const assigneeRoleHint = roleHint(formData.get('assigneeRoleHint'));
  const dueOffsetDays = intOrNull(formData.get('dueOffsetDays'));
  const isMandatory = bool(formData.get('isMandatory'));

  if (!titleAr) throw new Error('titleAr required');

  // Append to the end of this stage's ordered list.
  const posRes = await db.execute<{ next: number }>(sql`
    SELECT COALESCE(MAX(position), -1) + 1 AS next
    FROM stage_task_templates WHERE stage = ${stage}::project_stage
  `);
  const position = (posRes as unknown as { next: number }[])[0]?.next ?? 0;

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      INSERT INTO stage_task_templates
        (stage, title_ar, title_en, description, assignee_role_hint,
         due_offset_days, is_mandatory, position, active)
      VALUES (
        ${stage}::project_stage, ${titleAr}, ${titleEn}, ${description},
        ${assigneeRoleHint}::project_assignment_role, ${dueOffsetDays},
        ${isMandatory}, ${position}, true
      )
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'stage_task_template',
    action: 'stage_task_template.create',
    summaryAr: `أضاف مهمة قالب للمرحلة ${stage}`,
    summaryEn: `Added stage task template (${stage})`,
  });

  revalidatePath('/admin/stage-templates');
}

export async function updateStageTemplate(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const id = txt(formData.get('id'));
  const titleAr = txt(formData.get('titleAr'));
  const titleEn = txt(formData.get('titleEn'));
  const description = txt(formData.get('description'));
  const assigneeRoleHint = roleHint(formData.get('assigneeRoleHint'));
  const dueOffsetDays = intOrNull(formData.get('dueOffsetDays'));
  const isMandatory = bool(formData.get('isMandatory'));

  if (!id) throw new Error('id required');
  if (!titleAr) throw new Error('titleAr required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE stage_task_templates SET
        title_ar = ${titleAr},
        title_en = ${titleEn},
        description = ${description},
        assignee_role_hint = ${assigneeRoleHint}::project_assignment_role,
        due_offset_days = ${dueOffsetDays},
        is_mandatory = ${isMandatory}
      WHERE id = ${id}::uuid
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'stage_task_template',
    entityId: id,
    action: 'stage_task_template.update',
    summaryAr: `حدّث مهمة قالب`,
    summaryEn: `Updated stage task template`,
  });

  revalidatePath('/admin/stage-templates');
}

export async function toggleStageTemplate(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');
  const id = txt(formData.get('id'));
  if (!id) throw new Error('id required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE stage_task_templates SET active = NOT active WHERE id = ${id}::uuid
    `),
  );

  revalidatePath('/admin/stage-templates');
}

export async function deleteStageTemplate(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');
  const id = txt(formData.get('id'));
  if (!id) throw new Error('id required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`DELETE FROM stage_task_templates WHERE id = ${id}::uuid`),
  );

  await writeActivity({
    actorId,
    entityType: 'stage_task_template',
    entityId: id,
    action: 'stage_task_template.delete',
    summaryAr: 'حذف مهمة قالب',
    summaryEn: 'Deleted a stage task template',
  });

  revalidatePath('/admin/stage-templates');
}

/** Move a template up/down within its stage by swapping `position` with the neighbour. */
export async function reorderStageTemplate(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');
  const id = txt(formData.get('id'));
  const dir = txt(formData.get('dir')); // 'up' | 'down'
  if (!id || (dir !== 'up' && dir !== 'down')) throw new Error('bad reorder');

  await withActor(actorId, async (tx) => {
    const cur = (
      (await tx.execute(sql`
        SELECT stage::text AS stage, position FROM stage_task_templates WHERE id = ${id}::uuid
      `)) as unknown as { stage: string; position: number }[]
    )[0];
    if (!cur) return;

    const cmp = dir === 'up' ? sql`<` : sql`>`;
    const order = dir === 'up' ? sql`DESC` : sql`ASC`;
    const neighbour = (
      (await tx.execute(sql`
        SELECT id::text AS id, position FROM stage_task_templates
        WHERE stage = ${cur.stage}::project_stage AND position ${cmp} ${cur.position}
        ORDER BY position ${order} LIMIT 1
      `)) as unknown as { id: string; position: number }[]
    )[0];
    if (!neighbour) return;

    await tx.execute(
      sql`UPDATE stage_task_templates SET position = ${neighbour.position} WHERE id = ${id}::uuid`,
    );
    await tx.execute(
      sql`UPDATE stage_task_templates SET position = ${cur.position} WHERE id = ${neighbour.id}::uuid`,
    );
  });

  revalidatePath('/admin/stage-templates');
}
