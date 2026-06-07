'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';

/** Reject all but the highest-confidence pending suggestion per dedup key. */
async function dedupeType(actorId: string, type: string, keyExpr: string): Promise<number> {
  const r = await db.execute(sql`
    WITH ranked AS (
      SELECT id, row_number() OVER (
        PARTITION BY ${sql.raw(keyExpr)} ORDER BY confidence DESC, created_at DESC
      ) AS rn
      FROM ai_suggestions
      WHERE status = 'pending' AND suggestion_type = ${type}
        AND ${sql.raw(keyExpr)} IS NOT NULL AND ${sql.raw(keyExpr)} <> ''
    ), upd AS (
      UPDATE ai_suggestions s
      SET status = 'rejected', rejected_reason = 'cleanup: duplicate',
          approved_by_id = ${actorId}::uuid, updated_at = now()
      FROM ranked r WHERE s.id = r.id AND r.rn > 1
      RETURNING 1
    ) SELECT count(*)::int AS n FROM upd`);
  return Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0);
}

/**
 * One-click triage cleanup: rejects low-confidence task noise and de-duplicates
 * client/contact/project suggestions (keeping the highest-confidence one per
 * unique key). Reversible (status change) + writes one ai_action_log summary.
 */
export async function cleanupSuggestions(): Promise<{ ok: boolean; noise: number; dupes: number; error?: string }> {
  let actorId: string;
  try {
    actorId = await requirePermissionAction('ai_suggestion.approve');
  } catch {
    return { ok: false, noise: 0, dupes: 0, error: 'لا تملك صلاحية' };
  }

  const noiseRes = await db.execute(sql`
    WITH upd AS (
      UPDATE ai_suggestions
      SET status = 'rejected', rejected_reason = 'cleanup: low-confidence task',
          approved_by_id = ${actorId}::uuid, updated_at = now()
      WHERE status = 'pending' AND suggestion_type = 'create_task' AND confidence < 0.70
      RETURNING 1
    ) SELECT count(*)::int AS n FROM upd`);
  const noise = Number((noiseRes as unknown as Array<{ n: number }>)[0]?.n ?? 0);

  let dupes = 0;
  dupes += await dedupeType(actorId, 'create_client', "lower(proposed_data->>'name_ar')");
  dupes += await dedupeType(actorId, 'create_contact', "lower(proposed_data->>'email')");
  dupes += await dedupeType(actorId, 'create_project', "lower(proposed_data->>'title')");

  await db.execute(sql`
    INSERT INTO ai_action_log (feature, outcome, user_id, metadata)
    VALUES ('suggestion_cleanup', 'rejected', ${actorId}::uuid,
            ${JSON.stringify({ noise, dupes })}::jsonb)`);

  revalidatePath('/inbox/suggestions');
  revalidatePath('/crm');
  revalidatePath('/ai');
  return { ok: true, noise, dupes };
}

const REJECTABLE = new Set([
  'create_task', 'create_client', 'create_contact', 'create_project',
  'create_lead', 'escalate_to_human', 'update_project', 'link_thread_to_project',
]);

/** Reject ALL pending suggestions of one type (manual bulk dismiss). */
export async function bulkRejectType(type: string): Promise<{ ok: boolean; n: number }> {
  let actorId: string;
  try {
    actorId = await requirePermissionAction('ai_suggestion.approve');
  } catch {
    return { ok: false, n: 0 };
  }
  if (!REJECTABLE.has(type)) return { ok: false, n: 0 };
  const r = await db.execute(sql`
    WITH upd AS (
      UPDATE ai_suggestions
      SET status = 'rejected', rejected_reason = 'bulk reject by type',
          approved_by_id = ${actorId}::uuid, updated_at = now()
      WHERE status = 'pending' AND suggestion_type = ${type}
      RETURNING 1
    ) SELECT count(*)::int AS n FROM upd`);
  revalidatePath('/inbox/suggestions');
  return { ok: true, n: Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0) };
}
