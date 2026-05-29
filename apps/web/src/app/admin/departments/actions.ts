'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

/**
 * Departments CRUD — admin only (access.manage). Columns mirror orgs/people
 * `departments`: code (UNIQUE), name_ar, name_en, head_profile_id, position.
 * All writes run inside withActor so the audit trigger sees the principal on
 * the same pinned (transaction-pooler) connection.
 */

function txt(v: FormDataEntryValue | null): string | null {
  const s = v?.toString().trim();
  return s ? s : null;
}

export async function createDepartment(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const code = txt(formData.get('code'))?.toUpperCase();
  const nameAr = txt(formData.get('nameAr'));
  const nameEn = txt(formData.get('nameEn'));
  const headProfileId = txt(formData.get('headProfileId'));
  const position = Number(formData.get('position')?.toString() ?? '0') || 0;

  if (!code) throw new Error('code required');
  if (!nameAr) throw new Error('nameAr required');
  if (!nameEn) throw new Error('nameEn required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      INSERT INTO departments (code, name_ar, name_en, head_profile_id, position)
      VALUES (
        ${code}, ${nameAr}, ${nameEn},
        ${headProfileId}::uuid, ${position}
      )
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'department',
    action: 'department.create',
    summaryAr: `أنشأ قسم ${nameAr}`,
    summaryEn: `Created department ${nameEn}`,
  });

  revalidatePath('/admin/departments');
}

export async function updateDepartment(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const id = txt(formData.get('id'));
  const nameAr = txt(formData.get('nameAr'));
  const nameEn = txt(formData.get('nameEn'));
  const headProfileId = txt(formData.get('headProfileId'));
  const position = Number(formData.get('position')?.toString() ?? '0') || 0;

  if (!id) throw new Error('id required');
  if (!nameAr) throw new Error('nameAr required');
  if (!nameEn) throw new Error('nameEn required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE departments
      SET name_ar = ${nameAr},
          name_en = ${nameEn},
          head_profile_id = ${headProfileId}::uuid,
          position = ${position}
      WHERE id = ${id}::uuid
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'department',
    entityId: id,
    action: 'department.update',
    summaryAr: `حدّث قسم ${nameAr}`,
    summaryEn: `Updated department ${nameEn}`,
  });

  revalidatePath('/admin/departments');
}

export async function deleteDepartment(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const id = formData.get('id')?.toString();
  if (!id) throw new Error('id required');

  // Detach members first so the FK on profiles.department_id doesn't block the
  // delete (no cascade defined on that column).
  await withActor(actorId, async (tx) => {
    await tx.execute(sql`UPDATE profiles SET department_id = NULL WHERE department_id = ${id}::uuid`);
    await tx.execute(sql`DELETE FROM departments WHERE id = ${id}::uuid`);
  });

  await writeActivity({
    actorId,
    entityType: 'department',
    entityId: id,
    action: 'department.delete',
    summaryAr: 'حذف قسماً',
    summaryEn: 'Deleted a department',
  });

  revalidatePath('/admin/departments');
}
