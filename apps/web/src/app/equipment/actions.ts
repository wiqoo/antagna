'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function createEquipment(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (actor) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${actor.id}, true)`);
  }

  const code = formData.get('code')?.toString().trim().toUpperCase();
  const category = formData.get('category')?.toString().trim();
  const manufacturer = formData.get('manufacturer')?.toString().trim() || null;
  const model = formData.get('model')?.toString().trim();
  const groupId = formData.get('groupId')?.toString() || null;
  const serialNumber = formData.get('serialNumber')?.toString().trim() || null;
  const currentLocation = formData.get('currentLocation')?.toString().trim() || 'warehouse';
  const purchasePriceSar = formData.get('purchasePriceSar')?.toString() || null;
  const insuranceValueSar = formData.get('insuranceValueSar')?.toString() || null;
  const purchaseDate = formData.get('purchaseDate')?.toString() || null;
  const requiresCharging = formData.get('requiresCharging') === 'on';

  if (!code || !category || !model) throw new Error('code+category+model required');

  const res = await db.execute<{ id: string }>(sql`
    INSERT INTO equipment (
      code, category, manufacturer, model, group_id, serial_number,
      current_location, purchase_price_sar, insurance_value_sar,
      purchase_date, requires_charging
    )
    VALUES (
      ${code}, ${category}, ${manufacturer}, ${model},
      ${groupId ? sql`${groupId}::uuid` : sql`NULL`},
      ${serialNumber}, ${currentLocation},
      ${purchasePriceSar ? sql`${purchasePriceSar}::numeric` : sql`NULL`},
      ${insuranceValueSar ? sql`${insuranceValueSar}::numeric` : sql`NULL`},
      ${purchaseDate},
      ${requiresCharging}
    )
    RETURNING id
  `);

  const arr = res as unknown as Array<{ id: string }>;
  if (!arr[0]?.id) throw new Error('insert failed');

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
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const code = formData.get('code')?.toString().trim();
  const nameAr = formData.get('nameAr')?.toString().trim();
  const nameEn = formData.get('nameEn')?.toString().trim() || null;
  const description = formData.get('description')?.toString().trim() || null;
  const primaryEquipmentId = formData.get('primaryEquipmentId')?.toString() || null;
  if (!code || !nameAr) return;

  await db.execute(sql`
    INSERT INTO kits (code, name_ar, name_en, description, primary_equipment_id, active)
    VALUES (${code}, ${nameAr}, ${nameEn}, ${description},
            ${primaryEquipmentId ? sql`${primaryEquipmentId}::uuid` : sql`NULL`}, true)
    ON CONFLICT (code) DO NOTHING
  `);
  revalidatePath('/equipment/kits');
}

/** Add an equipment item to an existing kit. */
export async function addKitItem(
  kitId: string,
  formData: FormData,
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const equipmentId = formData.get('equipmentId')?.toString() || null;
  const qty = Number(formData.get('quantity')?.toString() ?? '1');
  const mandatory = formData.get('mandatory') === 'on';
  const notes = formData.get('notes')?.toString().trim() || null;
  if (!equipmentId) return;

  await db.execute(sql`
    INSERT INTO kit_items (kit_id, equipment_id, quantity, is_mandatory, notes)
    VALUES (${kitId}::uuid, ${equipmentId}::uuid,
            ${Number.isFinite(qty) && qty > 0 ? qty : 1},
            ${mandatory}, ${notes})
  `);
  revalidatePath('/equipment/kits');
}

export async function removeKitItem(itemId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await db.execute(sql`DELETE FROM kit_items WHERE id = ${itemId}::uuid`);
  revalidatePath('/equipment/kits');
}
