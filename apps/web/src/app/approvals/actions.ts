'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

type ActionResult = { ok: boolean; error?: string };

/**
 * One reviewer's decision on a pending internal_approval row. The acting
 * profile must own the row (reviewer_profile_id = effective me) AND the row
 * must still be pending — both enforced in the UPDATE's WHERE so a stale page
 * or a non-assigned user is a no-op. `decision` maps to the real enum:
 *   approve → 'approved'
 *   reject  → 'revisions_requested'  (no 'rejected' value in the enum)
 * The decider is the row's reviewer + the withActor audit principal; there is
 * no separate decided_by column, so reviewed_at is the decision timestamp.
 */
async function decide(
  approvalId: string,
  decision: 'approve' | 'reject',
  notes: string | null,
): Promise<ActionResult> {
  if (!approvalId) return { ok: false, error: 'missing approval id' };

  // Both approve and request-revision are gated on deliverable.approve — the
  // single "I can rule on this deliverable" capability.
  const me = await requirePermissionAction('deliverable.approve');

  const status = decision === 'approve' ? 'approved' : 'revisions_requested';
  const trimmed = notes?.trim() || null;

  const rows = (await withActor(me, (tx) =>
    tx.execute<{ id: string; deliverable_id: string | null }>(sql`
      UPDATE internal_approvals
         SET status = ${status}::internal_approval_status,
             reviewed_at = now(),
             notes = COALESCE(${trimmed}, notes),
             revision_request_text = ${
               decision === 'reject' ? sql`${trimmed}` : sql`revision_request_text`
             }
       WHERE id = ${approvalId}::uuid
         AND reviewer_profile_id = ${me}::uuid
         AND status = 'pending'
      RETURNING id, deliverable_id
    `),
  )) as unknown as Array<{ id: string; deliverable_id: string | null }>;

  if (!rows[0]?.id) {
    // Not yours, already decided, or gone — nothing changed.
    return { ok: false, error: 'تعذّر تسجيل القرار: البند غير متاح أو سبق البتّ فيه.' };
  }

  await writeActivity({
    actorId: me,
    entityType: 'internal_approval',
    entityId: rows[0].id,
    action: decision === 'approve' ? 'approval.approved' : 'approval.revisions_requested',
    summaryAr:
      decision === 'approve' ? 'اعتمد مخرجًا داخليًا' : 'طلب تعديلًا على مخرج داخلي',
    metadata: {
      deliverableId: rows[0].deliverable_id,
      decision: status,
      notes: trimmed,
    },
  });

  revalidatePath('/approvals');
  return { ok: true };
}

export async function approveApproval(
  approvalId: string,
  notes?: string,
): Promise<ActionResult> {
  return decide(approvalId, 'approve', notes ?? null);
}

export async function rejectApproval(
  approvalId: string,
  notes?: string,
): Promise<ActionResult> {
  return decide(approvalId, 'reject', notes ?? null);
}
