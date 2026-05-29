'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

/**
 * tags CRUD — admin only (access.manage). Polymorphic labels applied across
 * entities via tag_assignments.
 * Columns: key (UNIQUE), name_ar, name_en, color, category, scope_entity_type,
 * active.
 *
 * Writes run inside withActor so the audit trigger sees the principal.
 */

function txt(v: FormDataEntryValue | null): string | null {
  const s = v?.toString().trim();
  return s ? s : null;
}

function bool(v: FormDataEntryValue | null): boolean {
  return v === 'on' || v === 'true' || v === '1';
}

/** Slugify a free key into a stable identifier: lowercase, [a-z0-9_]. */
function slugKey(v: FormDataEntryValue | null): string | null {
  const s = txt(v);
  if (!s) return null;
  const k = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return k || null;
}

export async function createTag(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const key = slugKey(formData.get('key'));
  const nameAr = txt(formData.get('nameAr'));
  const nameEn = txt(formData.get('nameEn'));
  const color = txt(formData.get('color'));
  const category = txt(formData.get('category'));
  const scopeEntityType = txt(formData.get('scopeEntityType'));

  if (!key) throw new Error('key required');
  if (!nameAr) throw new Error('nameAr required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      INSERT INTO tags (key, name_ar, name_en, color, category, scope_entity_type, active)
      VALUES (${key}, ${nameAr}, ${nameEn}, ${color}, ${category}, ${scopeEntityType}, true)
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'tag',
    action: 'tag.create',
    summaryAr: `أضاف وسماً ${nameAr}`,
    summaryEn: `Added tag ${nameEn ?? key}`,
  });

  revalidatePath('/admin/tags');
}

export async function updateTag(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const id = txt(formData.get('id'));
  const nameAr = txt(formData.get('nameAr'));
  const nameEn = txt(formData.get('nameEn'));
  const color = txt(formData.get('color'));
  const category = txt(formData.get('category'));
  const scopeEntityType = txt(formData.get('scopeEntityType'));

  if (!id) throw new Error('id required');
  if (!nameAr) throw new Error('nameAr required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE tags SET
        name_ar = ${nameAr},
        name_en = ${nameEn},
        color = ${color},
        category = ${category},
        scope_entity_type = ${scopeEntityType}
      WHERE id = ${id}::uuid
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'tag',
    entityId: id,
    action: 'tag.update',
    summaryAr: `حدّث وسم ${nameAr}`,
    summaryEn: `Updated tag ${nameEn ?? nameAr}`,
  });

  revalidatePath('/admin/tags');
}

export async function toggleTag(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');
  const id = txt(formData.get('id'));
  if (!id) throw new Error('id required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`UPDATE tags SET active = NOT active WHERE id = ${id}::uuid`),
  );

  revalidatePath('/admin/tags');
}

export async function deleteTag(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');
  const id = txt(formData.get('id'));
  if (!id) throw new Error('id required');

  // Remove assignments first (no cascade on tag_assignments.tag_id FK).
  await withActor(actorId, async (tx) => {
    await tx.execute(sql`DELETE FROM tag_assignments WHERE tag_id = ${id}::uuid`);
    await tx.execute(sql`DELETE FROM tags WHERE id = ${id}::uuid`);
  });

  await writeActivity({
    actorId,
    entityType: 'tag',
    entityId: id,
    action: 'tag.delete',
    summaryAr: 'حذف وسماً',
    summaryEn: 'Deleted a tag',
  });

  revalidatePath('/admin/tags');
}
