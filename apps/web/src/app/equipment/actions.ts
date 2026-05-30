'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { parseNum, parseDate, parseStr } from '@/lib/parse';

export async function createEquipment(formData: FormData) {
  // No dedicated equipment.create key exists; equipment.update is the closest
  // existing key for mutating the equipment catalogue.
  const aid = await requirePermissionAction('equipment.update');

  const code = formData.get('code')?.toString().trim().toUpperCase();
  const category = parseStr(formData.get('category'));
  const manufacturer = parseStr(formData.get('manufacturer'));
  const model = parseStr(formData.get('model'));
  const groupId = parseStr(formData.get('groupId'));
  const serialNumber = parseStr(formData.get('serialNumber'));
  const currentLocation = parseStr(formData.get('currentLocation')) || 'warehouse';
  const purchasePriceSar = parseNum(formData.get('purchasePriceSar'));
  const insuranceValueSar = parseNum(formData.get('insuranceValueSar'));
  const purchaseDate = parseDate(formData.get('purchaseDate'));
  const requiresCharging = formData.get('requiresCharging') === 'on';

  if (!code || !category || !model) throw new Error('code+category+model required');

  const arr = await withActor(aid, (tx) =>
    tx.execute<{ id: string }>(sql`
      INSERT INTO equipment (
        code, category, manufacturer, model, group_id, serial_number,
        current_location, purchase_price_sar, insurance_value_sar,
        purchase_date, requires_charging
      )
      VALUES (
        ${code}, ${category}, ${manufacturer}, ${model},
        ${groupId ? sql`${groupId}::uuid` : sql`NULL`},
        ${serialNumber}, ${currentLocation},
        ${purchasePriceSar != null ? sql`${purchasePriceSar}::numeric` : sql`NULL`},
        ${insuranceValueSar != null ? sql`${insuranceValueSar}::numeric` : sql`NULL`},
        ${purchaseDate},
        ${requiresCharging}
      )
      RETURNING id
    `),
  );

  const rows = arr as unknown as Array<{ id: string }>;
  if (!rows[0]?.id) throw new Error('insert failed');

  revalidatePath('/equipment');
  redirect('/equipment');
}

// --- C1: AI photo identification ---

const ALLOWED_CATEGORIES = [
  'camera_body',
  'lens',
  'lighting',
  'audio',
  'gimbal',
  'drone',
  'tripod',
  'monitor',
  'accessory',
] as const;

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export type IdentifySuggestion = {
  brand: string;
  model: string;
  category: string;
  confidencePct: number;
  notes: string;
};

/**
 * Send a photo to Claude vision and get back a structured suggestion
 * (brand/model/category/confidence). Used to pre-fill /equipment/new — humans
 * still review + apply (human-in-the-loop).
 */
export async function identifyEquipmentPhoto(
  formData: FormData,
): Promise<{ ok: boolean; suggestion?: IdentifySuggestion; error?: string }> {
  await requirePermissionAction('equipment.update');
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'لا توجد صورة.' };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'الصيغة غير مدعومة (jpeg / png / webp / gif).' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: 'الصورة أكبر من 5 ميجابايت.' };
  }

  const { getAnthropic, ANTHROPIC_MODELS } = await import('@antagna/ai');
  const buf = Buffer.from(await file.arrayBuffer());
  const b64 = buf.toString('base64');

  const client = getAnthropic();
  let resp;
  try {
    resp = await client.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: b64,
              },
            },
            {
              type: 'text',
              text:
                'هذه صورة لمعدّة إنتاج (كاميرا، عدسة، إضاءة، صوت، جيمبال، درون، حامل، شاشة، ملحق). ' +
                'أجب بصيغة JSON فقط — لا نصّ آخر — بهذا الشكل:\n' +
                '{"brand":"...","model":"...","category":"camera_body|lens|lighting|audio|gimbal|drone|tripod|monitor|accessory","confidence":0.0,"notes_ar":"..."}\n' +
                'لو الصورة غير واضحة أو غير مؤكَّدة، اجعل confidence أقل من 0.3. ' +
                'category لا بدّ أن تكون من القائمة فقط.',
            },
          ],
        },
      ],
    });
  } catch (e) {
    console.error('[identifyEquipmentPhoto]', e);
    return { ok: false, error: 'تعذّر الاتصال بنموذج الرؤية.' };
  }

  const block = resp.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') return { ok: false, error: 'لا استجابة.' };
  let raw = block.text.trim();
  raw = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'تعذّر فهم إجابة النموذج.' };
  }

  const category = String(parsed.category ?? '').toLowerCase();
  const safeCategory = (ALLOWED_CATEGORIES as readonly string[]).includes(category)
    ? category
    : 'accessory';
  const confRaw = Number(parsed.confidence);
  const confidencePct = Number.isFinite(confRaw)
    ? Math.max(0, Math.min(100, Math.round(confRaw * 100)))
    : 0;

  return {
    ok: true,
    suggestion: {
      brand: String(parsed.brand ?? '').slice(0, 80),
      model: String(parsed.model ?? '').slice(0, 80),
      category: safeCategory,
      confidencePct,
      notes: String(parsed.notes_ar ?? '').slice(0, 240),
    },
  };
}

// --- C1: kits (presets) + items ---

/** Create a kit (a named bundle of equipment templated for a shoot type). */
export async function createKit(formData: FormData): Promise<void> {
  // No kit-specific permission key; kits are equipment config → equipment.update.
  const aid = await requirePermissionAction('equipment.update');

  const code = parseStr(formData.get('code'));
  const nameAr = parseStr(formData.get('nameAr'));
  const nameEn = parseStr(formData.get('nameEn'));
  const description = parseStr(formData.get('description'));
  const primaryEquipmentId = parseStr(formData.get('primaryEquipmentId'));
  if (!code || !nameAr) return;

  await withActor(aid, (tx) =>
    tx.execute(sql`
      INSERT INTO kits (code, name_ar, name_en, description, primary_equipment_id, active)
      VALUES (${code}, ${nameAr}, ${nameEn}, ${description},
              ${primaryEquipmentId ? sql`${primaryEquipmentId}::uuid` : sql`NULL`}, true)
      ON CONFLICT (code) DO NOTHING
    `),
  );
  revalidatePath('/equipment/kits');
}

/** Add an equipment item to an existing kit. */
export async function addKitItem(
  kitId: string,
  formData: FormData,
): Promise<void> {
  const aid = await requirePermissionAction('equipment.update');

  const equipmentId = parseStr(formData.get('equipmentId'));
  const qtyParsed = parseNum(formData.get('quantity'));
  const qty = qtyParsed != null && qtyParsed > 0 ? qtyParsed : 1;
  const mandatory = formData.get('mandatory') === 'on';
  const notes = parseStr(formData.get('notes'));
  if (!equipmentId) return;

  await withActor(aid, (tx) =>
    tx.execute(sql`
      INSERT INTO kit_items (kit_id, equipment_id, quantity, is_mandatory, notes)
      VALUES (${kitId}::uuid, ${equipmentId}::uuid,
              ${qty}, ${mandatory}, ${notes})
    `),
  );
  revalidatePath('/equipment/kits');
}

export async function removeKitItem(itemId: string): Promise<void> {
  const aid = await requirePermissionAction('equipment.update');
  await withActor(aid, (tx) =>
    tx.execute(sql`DELETE FROM kit_items WHERE id = ${itemId}::uuid`),
  );
  revalidatePath('/equipment/kits');
}

// --- C1: kit BUILDER (volt-os /lab/setups + /builder parity) ---

/**
 * Create a new setup (kit) anchored on a primary item, in one shot.
 * Used by the builder's "start a setup" step. Returns the new kit id so the
 * builder can deep-link straight into editing it.
 */
export async function createSetup(formData: FormData): Promise<{
  ok: boolean;
  kitId?: string;
  error?: string;
}> {
  const aid = await requirePermissionAction('equipment.update');

  const nameAr = parseStr(formData.get('nameAr'));
  const primaryEquipmentId = parseStr(formData.get('primaryEquipmentId'));
  let code = parseStr(formData.get('code'));
  if (!nameAr) return { ok: false, error: 'الاسم مطلوب' };

  // Auto-generate a code if none supplied (SETUP-XXXX from the timestamp).
  if (!code) {
    code = `SETUP-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  }

  let kitId: string | undefined;
  try {
    const res = await withActor(aid, (tx) =>
      tx.execute<{ id: string }>(sql`
        INSERT INTO kits (code, name_ar, primary_equipment_id, active)
        VALUES (${code}, ${nameAr},
                ${primaryEquipmentId ? sql`${primaryEquipmentId}::uuid` : sql`NULL`}, true)
        ON CONFLICT (code) DO NOTHING
        RETURNING id::text AS id
      `),
    );
    kitId = (res as unknown as Array<{ id: string }>)[0]?.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر الإنشاء' };
  }
  if (!kitId) return { ok: false, error: 'الـ code مستخدَم بالفعل' };

  revalidatePath('/equipment/kits');
  return { ok: true, kitId };
}

/** Add an item to a setup by its id (item OR group), with mandatory + qty. */
export async function addSetupItem(
  kitId: string,
  payload: {
    equipmentId?: string | null;
    equipmentGroupId?: string | null;
    quantity?: number;
    mandatory?: boolean;
    notes?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  const aid = await requirePermissionAction('equipment.update');
  const qty = payload.quantity && payload.quantity > 0 ? payload.quantity : 1;
  const mandatory = !!payload.mandatory;
  if (!payload.equipmentId && !payload.equipmentGroupId) {
    return { ok: false, error: 'لا عنصر' };
  }
  try {
    await withActor(aid, (tx) =>
      tx.execute(sql`
        INSERT INTO kit_items (kit_id, equipment_id, equipment_group_id, quantity, is_mandatory, notes)
        VALUES (
          ${kitId}::uuid,
          ${payload.equipmentId ? sql`${payload.equipmentId}::uuid` : sql`NULL`},
          ${payload.equipmentGroupId ? sql`${payload.equipmentGroupId}::uuid` : sql`NULL`},
          ${qty}, ${mandatory}, ${payload.notes ?? null}
        )
      `),
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر الإضافة' };
  }
  revalidatePath('/equipment/kits');
  return { ok: true };
}

/** Remove a setup item by id (builder version → returns status, no throw). */
export async function removeSetupItem(itemId: string): Promise<{ ok: boolean }> {
  const aid = await requirePermissionAction('equipment.update');
  await withActor(aid, (tx) =>
    tx.execute(sql`DELETE FROM kit_items WHERE id = ${itemId}::uuid`),
  );
  revalidatePath('/equipment/kits');
  return { ok: true };
}

/** Flip an item between mandatory and optional. */
export async function toggleSetupItemMandatory(
  itemId: string,
  mandatory: boolean,
): Promise<{ ok: boolean }> {
  const aid = await requirePermissionAction('equipment.update');
  await withActor(aid, (tx) =>
    tx.execute(sql`
      UPDATE kit_items SET is_mandatory = ${mandatory} WHERE id = ${itemId}::uuid
    `),
  );
  revalidatePath('/equipment/kits');
  return { ok: true };
}

/** Bump an item's quantity. */
export async function setSetupItemQuantity(
  itemId: string,
  quantity: number,
): Promise<{ ok: boolean }> {
  const aid = await requirePermissionAction('equipment.update');
  const qty = quantity > 0 ? quantity : 1;
  await withActor(aid, (tx) =>
    tx.execute(sql`UPDATE kit_items SET quantity = ${qty} WHERE id = ${itemId}::uuid`),
  );
  revalidatePath('/equipment/kits');
  return { ok: true };
}

/** Rename / re-anchor a setup (name + primary item + active flag). */
export async function renameSetup(
  kitId: string,
  payload: { nameAr?: string; nameEn?: string | null; description?: string | null; active?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const aid = await requirePermissionAction('equipment.update');
  const nameAr = payload.nameAr?.trim();
  if (!nameAr) return { ok: false, error: 'الاسم مطلوب' };
  await withActor(aid, (tx) =>
    tx.execute(sql`
      UPDATE kits SET
        name_ar = ${nameAr},
        name_en = ${payload.nameEn ?? null},
        description = ${payload.description ?? null},
        active = ${payload.active ?? true}
      WHERE id = ${kitId}::uuid
    `),
  );
  revalidatePath('/equipment/kits');
  return { ok: true };
}

/** Anchor (or re-anchor) a setup onto a primary item. */
export async function setSetupPrimary(
  kitId: string,
  equipmentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const aid = await requirePermissionAction('equipment.update');
  if (!equipmentId) return { ok: false, error: 'لا عنصر' };
  await withActor(aid, (tx) =>
    tx.execute(sql`
      UPDATE kits SET primary_equipment_id = ${equipmentId}::uuid WHERE id = ${kitId}::uuid
    `),
  );
  revalidatePath('/equipment/kits');
  return { ok: true };
}

/** Delete an entire setup (cascades its items). */
export async function deleteSetup(kitId: string): Promise<{ ok: boolean }> {
  const aid = await requirePermissionAction('equipment.update');
  await withActor(aid, (tx) =>
    tx.execute(sql`DELETE FROM kits WHERE id = ${kitId}::uuid`),
  );
  revalidatePath('/equipment/kits');
  return { ok: true };
}
