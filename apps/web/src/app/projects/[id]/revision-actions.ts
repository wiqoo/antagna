'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { writeActivity } from '@/lib/activity';
import { requirePermissionAction } from '@/lib/authz';

/**
 * Revision rounds (feedback cycles) on a project.
 *
 * A round groups the change requests for one feedback pass. revision_items
 * hang off a round; the round is "resolved" when the team has addressed the
 * feedback. round_number is per-project and auto-increments (next = max + 1).
 *
 * startRevision  → revision.start  : open a new round (optionally with the
 *                  client feedback + a first batch of change-request items).
 * resolveRevision → revision.resolve : close a round (and its open items).
 */
export async function startRevision(projectId: string, formData: FormData) {
  const actorId = await requirePermissionAction('revision.start');

  const clientFeedback =
    formData.get('clientFeedback')?.toString().trim() || null;
  const summary = formData.get('summary')?.toString().trim() || null;
  // One change-request per non-empty line in the items textarea.
  const items = (formData.get('items')?.toString() ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 50);

  const newRoundNumber = await withActor(actorId, async (tx) => {
    const res = (await tx.execute(sql`
      SELECT COALESCE(MAX(round_number), 0) + 1 AS next
      FROM revision_rounds
      WHERE project_id = ${projectId}::uuid
    `)) as unknown as Array<{ next: number }>;
    const roundNumber = Number(res[0]?.next ?? 1);

    const inserted = (await tx.execute(sql`
      INSERT INTO revision_rounds
        (project_id, round_number, initiated_by_id, summary, client_feedback)
      VALUES (
        ${projectId}::uuid,
        ${roundNumber},
        ${actorId}::uuid,
        ${summary},
        ${clientFeedback}
      )
      RETURNING id::text AS id
    `)) as unknown as Array<{ id: string }>;
    const roundId = inserted[0]?.id;

    if (roundId && items.length > 0) {
      await tx.execute(sql`
        INSERT INTO revision_items (round_id, change_request, status)
        VALUES ${sql.join(
          items.map(
            (req) => sql`(${roundId}::uuid, ${req}, 'open')`,
          ),
          sql`, `,
        )}
      `);
    }

    return roundNumber;
  });

  await writeActivity({
    actorId,
    entityType: 'project',
    entityId: projectId,
    projectId,
    action: 'revision_started',
    summaryAr: `بدأت جولة مراجعة #${newRoundNumber}${items.length ? ` (${items.length} تغيير)` : ''}`,
    summaryEn: `Revision round #${newRoundNumber} started${items.length ? ` (${items.length} changes)` : ''}`,
    metadata: { round_number: newRoundNumber, item_count: items.length },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function resolveRevision(projectId: string, roundId: string) {
  const actorId = await requirePermissionAction('revision.resolve');

  const roundNumber = await withActor(actorId, async (tx) => {
    const res = (await tx.execute(sql`
      UPDATE revision_rounds
      SET resolved_at = now()
      WHERE id = ${roundId}::uuid
        AND project_id = ${projectId}::uuid
      RETURNING round_number AS round_number
    `)) as unknown as Array<{ round_number: number }>;

    // Close any still-open change-request items in this round.
    await tx.execute(sql`
      UPDATE revision_items
      SET status = 'done',
          resolved_at = now(),
          resolved_by_id = ${actorId}::uuid
      WHERE round_id = ${roundId}::uuid
        AND status = 'open'
    `);

    return res[0]?.round_number ?? null;
  });

  await writeActivity({
    actorId,
    entityType: 'project',
    entityId: projectId,
    projectId,
    action: 'revision_resolved',
    summaryAr: `أُغلقت جولة المراجعة${roundNumber != null ? ` #${roundNumber}` : ''}`,
    summaryEn: `Revision round${roundNumber != null ? ` #${roundNumber}` : ''} resolved`,
    metadata: { round_number: roundNumber ?? undefined },
  });

  revalidatePath(`/projects/${projectId}`);
}
