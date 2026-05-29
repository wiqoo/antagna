'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db, projects, withActor } from '@antagna/db';
import { writeActivity } from '@/lib/activity';
import { notify } from '@/lib/notify';
import { stageLabelAr } from '@/lib/project-stage';
import { requirePermissionAction } from '@/lib/authz';

type StageVal = (typeof import('@antagna/db').projectStageEnum.enumValues)[number];

const VALID_STAGES: ReadonlyArray<StageVal> = [
  'lead',
  'brief',
  'quoted',
  'approved',
  'planning',
  'shooting',
  'editing',
  'review',
  'delivered',
  'archived',
  'lost',
  'cancelled',
];

export async function transitionStage(
  projectId: string,
  nextStage: StageVal,
  reason: string | null,
) {
  if (!VALID_STAGES.includes(nextStage)) {
    return { ok: false, error: `Invalid stage: ${nextStage}` };
  }

  const actorId = await requirePermissionAction('project.change_stage');

  // The DB trigger on `projects` writes to project_stages_log itself (Pillar 5).
  // We just UPDATE and set updatedAt + appropriate timestamp columns.
  const now = new Date();
  const setCols: Record<string, unknown> = {
    stage: nextStage,
    updatedAt: now,
  };
  if (nextStage === 'quoted') setCols.quotedAt = now;
  if (nextStage === 'approved') setCols.approvedAt = now;
  if (nextStage === 'delivered') setCols.deliveredAt = now;
  if (nextStage === 'archived') setCols.archivedAt = now;
  if (nextStage === 'lost') setCols.lostReason = reason ?? null;

  // Pass actor + reason to the trigger via session GUCs (read by fn_log_project_stage).
  // Both the acting_as and the stage_change_reason GUC must share the pinned
  // connection with the UPDATE, so set the reason inside the same transaction.
  await withActor(actorId, async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.stage_change_reason', ${reason ?? ''}, true)`,
    );
    await tx.update(projects).set(setCols).where(eq(projects.id, projectId));
  });

  await writeActivity({
    actorId,
    entityType: 'project',
    entityId: projectId,
    projectId,
    action: 'stage_changed',
    summaryAr: `تغيّرت المرحلة إلى «${stageLabelAr(nextStage)}»${reason ? ` — ${reason}` : ''}`,
    summaryEn: `Stage changed to ${nextStage}${reason ? ` — ${reason}` : ''}`,
    metadata: { to_stage: nextStage, reason: reason ?? undefined },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');

  // Trigger AI re-analysis in the background — don't block the redirect.
  // Stage changes are the cheapest moment to refresh risk + next-action.
  import('./ai-actions')
    .then((m) => m.reanalyzeProject(projectId, true))
    .catch((err) => console.error('[transitionStage] reanalyze failed', err));

  return { ok: true };
}

export async function postComment(projectId: string, body: string) {
  if (!body.trim()) return { ok: false, error: 'empty' };

  // Posting a comment is a write on the project; gate on project.update
  // (no dedicated comment permission key exists).
  const actorId = await requirePermissionAction('project.update');

  await withActor(actorId, (tx) =>
    tx.execute(
      sql`INSERT INTO project_comments (project_id, author_id, body)
          VALUES (${projectId}::uuid, ${actorId}::uuid, ${body.trim()})`,
    ),
  );

  await writeActivity({
    actorId,
    entityType: 'project',
    entityId: projectId,
    projectId,
    action: 'comment_posted',
    summaryAr: `تعليق جديد: ${body.trim().slice(0, 140)}`,
    summaryEn: `New comment: ${body.trim().slice(0, 140)}`,
  });

  // Notify the project's PM (unless they wrote it) in their language.
  const [proj] = (await db.execute(sql`
    SELECT project_manager_id::text AS pm, COALESCE(title_ar, title) AS t
    FROM projects WHERE id = ${projectId}::uuid
  `)) as unknown as { pm: string | null; t: string }[];
  if (proj?.pm && proj.pm !== actorId) {
    const snippet = body.trim().slice(0, 100);
    await notify({
      recipientId: proj.pm,
      event: 'on_comment',
      content: {
        ar: { title: `تعليق جديد على «${proj.t}»`, body: snippet },
        en: { title: `New comment on "${proj.t}"`, body: snippet },
      },
      linkUrl: `/projects/${projectId}`,
      entityType: 'project',
      entityId: projectId,
    }).catch((e) => console.error('[postComment notify]', e));
  }

  // @mentions — match each @token against email prefix (the part before @).
  // Notify each matched profile (excluding the author and PM-already-notified).
  const tokens = Array.from(
    new Set(
      (body.match(/@([A-Za-z0-9._-]{2,32})/g) ?? []).map((t) =>
        t.slice(1).toLowerCase(),
      ),
    ),
  );
  if (tokens.length > 0) {
    const mentioned = (await db.execute(sql`
      SELECT id::text AS id, email
      FROM profiles
      WHERE active = true
        AND split_part(LOWER(email), '@', 1) = ANY(${tokens}::text[])
    `)) as unknown as { id: string; email: string }[];
    const snippet = body.trim().slice(0, 100);
    for (const m of mentioned) {
      if (m.id === actorId) continue;
      if (m.id === proj?.pm) continue; // already notified on_comment
      await notify({
        recipientId: m.id,
        event: 'on_mention',
        content: {
          ar: { title: `ذُكِرت في «${proj?.t ?? ''}»`, body: snippet },
          en: { title: `Mentioned in "${proj?.t ?? ''}"`, body: snippet },
        },
        linkUrl: `/projects/${projectId}`,
        entityType: 'project',
        entityId: projectId,
      }).catch((e) => console.error('[postComment mention]', e));
    }
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// keep the `and` import alive for lint / future filters
void and;
