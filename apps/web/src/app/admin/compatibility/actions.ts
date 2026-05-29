'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

/**
 * compatibility_rules CRUD — admin only (access.manage). A rule links two sides;
 * each side is ONE of: a specific equipment item, an equipment group, or a free
 * tag string. verdict ∈ compatible|incompatible|unverified.
 *
 * Columns: item_a_id, item_b_id, group_a_id, group_b_id, tag_a, tag_b, verdict,
 * reason_ar, reason_en, source ('manual' | 'promoted_from_feedback' |
 * 'ai_inferred'), verified_count, created_by, created_at.
 *
 * Writes run inside withActor so the audit trigger sees the principal.
 */

const VERDICTS = ['compatible', 'incompatible', 'unverified'] as const;

function txt(v: FormDataEntryValue | null): string | null {
  const s = v?.toString().trim();
  return s ? s : null;
}

function verdict(v: FormDataEntryValue | null): string {
  const s = txt(v);
  if (!s || !(VERDICTS as readonly string[]).includes(s)) throw new Error('invalid verdict');
  return s;
}

/**
 * A side is encoded in the form as "<kind>:<value>" where kind ∈ item|group|tag.
 * Returns the three column candidates for that side, exactly one non-null.
 */
function side(raw: FormDataEntryValue | null): {
  itemId: string | null;
  groupId: string | null;
  tag: string | null;
} {
  const s = txt(raw);
  if (!s) return { itemId: null, groupId: null, tag: null };
  const idx = s.indexOf(':');
  const kind = idx >= 0 ? s.slice(0, idx) : '';
  const value = idx >= 0 ? s.slice(idx + 1) : '';
  if (kind === 'item') return { itemId: value || null, groupId: null, tag: null };
  if (kind === 'group') return { itemId: null, groupId: value || null, tag: null };
  if (kind === 'tag') return { itemId: null, groupId: null, tag: value || null };
  return { itemId: null, groupId: null, tag: null };
}

export async function createCompatibilityRule(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const a = side(formData.get('sideA'));
  const b = side(formData.get('sideB'));
  const v = verdict(formData.get('verdict'));
  const reasonAr = txt(formData.get('reasonAr'));
  const reasonEn = txt(formData.get('reasonEn'));

  const aSet = a.itemId || a.groupId || a.tag;
  const bSet = b.itemId || b.groupId || b.tag;
  if (!aSet || !bSet) throw new Error('both sides required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      INSERT INTO compatibility_rules
        (item_a_id, item_b_id, group_a_id, group_b_id, tag_a, tag_b,
         verdict, reason_ar, reason_en, source, verified_count, created_by)
      VALUES (
        ${a.itemId}::uuid, ${b.itemId}::uuid,
        ${a.groupId}::uuid, ${b.groupId}::uuid,
        ${a.tag}, ${b.tag},
        ${v}::compatibility_verdict, ${reasonAr}, ${reasonEn},
        'manual', 1, ${actorId}::uuid
      )
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'compatibility_rule',
    action: 'compatibility_rule.create',
    summaryAr: `أضاف قاعدة توافق (${v})`,
    summaryEn: `Added compatibility rule (${v})`,
  });

  revalidatePath('/admin/compatibility');
}

export async function updateCompatibilityRule(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const id = txt(formData.get('id'));
  const v = verdict(formData.get('verdict'));
  const reasonAr = txt(formData.get('reasonAr'));
  const reasonEn = txt(formData.get('reasonEn'));
  if (!id) throw new Error('id required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE compatibility_rules SET
        verdict = ${v}::compatibility_verdict,
        reason_ar = ${reasonAr},
        reason_en = ${reasonEn}
      WHERE id = ${id}::uuid
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'compatibility_rule',
    entityId: id,
    action: 'compatibility_rule.update',
    summaryAr: `حدّث قاعدة توافق`,
    summaryEn: `Updated compatibility rule`,
  });

  revalidatePath('/admin/compatibility');
}

export async function deleteCompatibilityRule(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');
  const id = txt(formData.get('id'));
  if (!id) throw new Error('id required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`DELETE FROM compatibility_rules WHERE id = ${id}::uuid`),
  );

  await writeActivity({
    actorId,
    entityType: 'compatibility_rule',
    entityId: id,
    action: 'compatibility_rule.delete',
    summaryAr: 'حذف قاعدة توافق',
    summaryEn: 'Deleted a compatibility rule',
  });

  revalidatePath('/admin/compatibility');
}
