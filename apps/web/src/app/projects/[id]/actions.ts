'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db, projects, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

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

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

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
  await db.execute(
    sql`SELECT set_config('app.acting_as', ${actor?.id ?? ''}, true),
               set_config('app.stage_change_reason', ${reason ?? ''}, true)`,
  );

  await db.update(projects).set(setCols).where(eq(projects.id, projectId));

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

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  if (!actor) return { ok: false, error: 'profile-not-found' };

  await db.execute(
    sql`INSERT INTO project_comments (project_id, author_id, body)
        VALUES (${projectId}::uuid, ${actor.id}::uuid, ${body.trim()})`,
  );

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// keep the `and` import alive for lint / future filters
void and;
