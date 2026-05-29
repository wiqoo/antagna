'use server';

/**
 * Skills-catalog admin actions (volt-os parity /admin/skills).
 *
 * The `skills` table is the production-skills catalogue (shooter / editor /
 * drone_pilot …) — renamed from `capabilities` in migration 048 (D-038/D-041).
 * Every write is gated on `access.manage` (the same key that guards the
 * roles/permissions matrix) and runs inside `withActor(pid, …)` so the audit
 * trigger (`trg_skills_audit`) records the real principal.
 *
 * `key` is the primary key (immutable once created — it's referenced by
 * user_skills). Editing changes the display fields only.
 */

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { parseStr } from '@/lib/parse';

const CATEGORIES = new Set(['production', 'post', 'business', 'admin']);

/** Normalise a free-typed key into the snake_case slug we store. */
function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function safeCategory(raw: string | null): string | null {
  if (!raw) return null;
  return CATEGORIES.has(raw) ? raw : null;
}

/** Create a new skill. Appends to the end of its category ordering. */
export async function createSkill(formData: FormData): Promise<void> {
  const pid = await requirePermissionAction('access.manage');

  const rawKey = parseStr(formData.get('key'));
  const nameAr = parseStr(formData.get('nameAr'));
  const nameEn = parseStr(formData.get('nameEn'));
  const category = safeCategory(parseStr(formData.get('category')));
  const description = parseStr(formData.get('description'));
  const iconKey = parseStr(formData.get('iconKey'));

  if (!rawKey || !nameAr || !nameEn) {
    throw new Error('key + name_ar + name_en required');
  }
  const key = normalizeKey(rawKey);
  if (!key) throw new Error('invalid key');

  await withActor(pid, (tx) =>
    tx.execute(sql`
      INSERT INTO skills (key, name_ar, name_en, category, description, icon_key, active, position)
      VALUES (
        ${key}, ${nameAr}, ${nameEn},
        ${category}, ${description}, ${iconKey},
        true,
        COALESCE((SELECT MAX(position) + 1 FROM skills), 0)
      )
      ON CONFLICT (key) DO NOTHING
    `),
  );

  revalidatePath('/admin/skills');
}

/** Edit a skill's display fields (key is immutable — it's an FK target). */
export async function updateSkill(formData: FormData): Promise<void> {
  const pid = await requirePermissionAction('access.manage');

  const key = parseStr(formData.get('key'));
  const nameAr = parseStr(formData.get('nameAr'));
  const nameEn = parseStr(formData.get('nameEn'));
  const category = safeCategory(parseStr(formData.get('category')));
  const description = parseStr(formData.get('description'));
  const iconKey = parseStr(formData.get('iconKey'));

  if (!key || !nameAr || !nameEn) {
    throw new Error('key + name_ar + name_en required');
  }

  await withActor(pid, (tx) =>
    tx.execute(sql`
      UPDATE skills SET
        name_ar = ${nameAr},
        name_en = ${nameEn},
        category = ${category},
        description = ${description},
        icon_key = ${iconKey}
      WHERE key = ${key}
    `),
  );

  revalidatePath('/admin/skills');
}

/** Flip active on/off. Inactive skills stay assignable history but hide from pickers. */
export async function toggleSkillActive(key: string): Promise<void> {
  const pid = await requirePermissionAction('access.manage');
  if (!key) return;

  await withActor(pid, (tx) =>
    tx.execute(sql`UPDATE skills SET active = NOT active WHERE key = ${key}`),
  );

  revalidatePath('/admin/skills');
}

/**
 * Move a skill one slot up/down by swapping its `position` with the adjacent
 * skill (ordered by position, key). Done inside one transaction so the swap is
 * atomic and never leaves duplicate positions.
 */
export async function reorderSkill(key: string, direction: 'up' | 'down'): Promise<void> {
  const pid = await requirePermissionAction('access.manage');
  if (!key || (direction !== 'up' && direction !== 'down')) return;

  await withActor(pid, async (tx) => {
    const cur = (await tx.execute<{ position: number }>(
      sql`SELECT position FROM skills WHERE key = ${key}`,
    )) as unknown as Array<{ position: number }>;
    const curPos = cur[0]?.position;
    if (curPos == null) return;

    // The neighbour in the requested direction (closest position on that side,
    // tie-broken by key to match the page ordering).
    const neighbour = (await tx.execute<{ key: string; position: number }>(
      direction === 'up'
        ? sql`SELECT key, position FROM skills
               WHERE (position < ${curPos}) OR (position = ${curPos} AND key < ${key})
               ORDER BY position DESC, key DESC LIMIT 1`
        : sql`SELECT key, position FROM skills
               WHERE (position > ${curPos}) OR (position = ${curPos} AND key > ${key})
               ORDER BY position ASC, key ASC LIMIT 1`,
    )) as unknown as Array<{ key: string; position: number }>;

    const other = neighbour[0];
    if (!other) return; // already at the edge

    // Swap positions. If they share a position (legacy data) nudge the moved one.
    if (other.position === curPos) {
      await tx.execute(
        sql`UPDATE skills SET position = ${curPos + (direction === 'up' ? -1 : 1)} WHERE key = ${key}`,
      );
    } else {
      await tx.execute(sql`UPDATE skills SET position = ${curPos} WHERE key = ${other.key}`);
      await tx.execute(sql`UPDATE skills SET position = ${other.position} WHERE key = ${key}`);
    }
  });

  revalidatePath('/admin/skills');
}
