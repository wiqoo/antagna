'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { withActor, customFieldDefinitions } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { CF_ENTITY_TYPES, CF_FIELD_TYPES, type FieldType } from './constants';

/**
 * Custom-field-definition builder (volt-os parity /admin/custom-fields).
 *
 * CRUD over `custom_field_definitions` — the field-definition catalog that
 * powers per-entity custom data (`custom_field_values`). Gated on
 * `settings.update` and every mutation runs inside `withActor(pid, …)` so the
 * audit trigger sees the actor (the GUC + write must share one pinned pooled
 * connection — see auth-context.ts).
 *
 * Schema columns: entity_type, key, label_ar, label_en, field_type, options
 * (jsonb), required, position, active. UNIQUE(entity_type, key).
 */

const ENTITY_SET = new Set<string>(CF_ENTITY_TYPES);
const TYPE_SET = new Set<string>(CF_FIELD_TYPES);
const KEY_RE = /^[a-z][a-z0-9_]*$/;

function bounce(message: string): never {
  redirect(`/admin/custom-fields?error=${encodeURIComponent(message)}`);
}

/** Parse the textarea "one option per line" into a {choices:[{value,label}]} jsonb. */
function parseOptions(raw: string): Record<string, unknown> {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const choices = lines.map((line) => {
    // "value | label" or just "value" (value==label).
    const [value, label] = line.split('|').map((s) => s.trim());
    return { value, label: label || value };
  });
  return { choices };
}

export async function createCustomField(formData: FormData) {
  const actor = await requirePermissionAction('settings.update');

  const entityType = String(formData.get('entity_type') ?? '').trim();
  const key = String(formData.get('key') ?? '').trim().toLowerCase();
  const labelAr = String(formData.get('label_ar') ?? '').trim();
  const labelEn = String(formData.get('label_en') ?? '').trim();
  const fieldType = String(formData.get('field_type') ?? '').trim() as FieldType;
  const required = formData.get('required') === 'on';
  const optionsRaw = String(formData.get('options') ?? '');

  if (!entityType || !key || !labelAr || !fieldType) {
    bounce('الكيان والمفتاح والاسم والنوع كلها مطلوبة');
  }
  if (!ENTITY_SET.has(entityType)) bounce('نوع الكيان غير صالح');
  if (!TYPE_SET.has(fieldType)) bounce('نوع الحقل غير صالح');
  if (!KEY_RE.test(key)) {
    bounce('المفتاح يجب أن يبدأ بحرف ويحتوي حروفاً صغيرة وأرقاماً و _ فقط');
  }

  const needsOptions = fieldType === 'select' || fieldType === 'multi_select';
  const options = needsOptions ? parseOptions(optionsRaw) : {};
  if (needsOptions && (options.choices as unknown[]).length === 0) {
    bounce('حقول الاختيار تحتاج خياراً واحداً على الأقل');
  }

  try {
    await withActor(actor, async (tx) => {
      // position = next slot for this entity_type.
      const rows = (await tx.execute<{ next: number }>(
        sql`SELECT COALESCE(MAX(position) + 1, 0)::int AS next
            FROM custom_field_definitions WHERE entity_type = ${entityType}`,
      )) as unknown as { next: number }[];
      const next = rows[0]?.next ?? 0;
      await tx.insert(customFieldDefinitions).values({
        entityType,
        key,
        labelAr,
        labelEn: labelEn || null,
        fieldType,
        options,
        required,
        position: next,
        active: true,
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('cf_def_unique') || msg.includes('duplicate key')) {
      bounce(`المفتاح «${key}» مستخدم بالفعل لهذا الكيان`);
    }
    bounce('تعذّر إنشاء الحقل');
  }

  revalidatePath('/admin/custom-fields');
  redirect('/admin/custom-fields?ok=' + encodeURIComponent('تم إنشاء الحقل'));
}

export async function updateCustomField(formData: FormData) {
  const actor = await requirePermissionAction('settings.update');

  const id = String(formData.get('id') ?? '').trim();
  const labelAr = String(formData.get('label_ar') ?? '').trim();
  const labelEn = String(formData.get('label_en') ?? '').trim();
  const required = formData.get('required') === 'on';
  const optionsRaw = String(formData.get('options') ?? '');
  const fieldType = String(formData.get('field_type') ?? '').trim() as FieldType;

  if (!id || !labelAr) bounce('المعرّف والاسم مطلوبان');

  const needsOptions = fieldType === 'select' || fieldType === 'multi_select';
  const options = needsOptions ? parseOptions(optionsRaw) : {};

  await withActor(actor, (tx) =>
    tx
      .update(customFieldDefinitions)
      .set({
        labelAr,
        labelEn: labelEn || null,
        required,
        ...(needsOptions ? { options } : {}),
      })
      .where(eq(customFieldDefinitions.id, id)),
  );

  revalidatePath('/admin/custom-fields');
  redirect('/admin/custom-fields?ok=' + encodeURIComponent('تم الحفظ'));
}

/** Toggle active flag (soft enable/disable) — values stay intact. */
export async function toggleCustomField(id: string) {
  const actor = await requirePermissionAction('settings.update');
  await withActor(actor, (tx) =>
    tx.execute(
      sql`UPDATE custom_field_definitions SET active = NOT active WHERE id = ${id}::uuid`,
    ),
  );
  revalidatePath('/admin/custom-fields');
}

/** Reorder within an entity_type (swap position with neighbour). */
export async function moveCustomField(id: string, direction: 'up' | 'down') {
  const actor = await requirePermissionAction('settings.update');
  await withActor(actor, async (tx) => {
    const [cur] = (await tx
      .select({
        id: customFieldDefinitions.id,
        entityType: customFieldDefinitions.entityType,
        position: customFieldDefinitions.position,
      })
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.id, id))
      .limit(1)) as { id: string; entityType: string; position: number }[];
    if (!cur) return;

    const cmp = direction === 'up' ? sql`position < ${cur.position}` : sql`position > ${cur.position}`;
    const order = direction === 'up' ? sql`position DESC` : sql`position ASC`;
    const neighbours = (await tx.execute<{ id: string; position: number }>(
      sql`SELECT id, position FROM custom_field_definitions
          WHERE entity_type = ${cur.entityType} AND ${cmp}
          ORDER BY ${order} LIMIT 1`,
    )) as unknown as { id: string; position: number }[];
    const neighbour = neighbours[0];
    if (!neighbour) return;

    await tx
      .update(customFieldDefinitions)
      .set({ position: neighbour.position })
      .where(eq(customFieldDefinitions.id, cur.id));
    await tx
      .update(customFieldDefinitions)
      .set({ position: cur.position })
      .where(eq(customFieldDefinitions.id, neighbour.id));
  });
  revalidatePath('/admin/custom-fields');
}

export async function deleteCustomField(id: string) {
  const actor = await requirePermissionAction('settings.update');
  // Block delete if values exist — preserve data integrity; ask user to disable.
  const used = (await withActor(actor, (tx) =>
    tx.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM custom_field_values WHERE definition_id = ${id}::uuid`,
    ),
  )) as unknown as { n: number }[];
  if ((used[0]?.n ?? 0) > 0) {
    bounce('لا يمكن حذف حقل له قيم مسجّلة — عطّله بدل الحذف');
  }
  await withActor(actor, (tx) =>
    tx.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, id)),
  );
  revalidatePath('/admin/custom-fields');
}
