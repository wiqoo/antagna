'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage } from '@antagna/ai';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermissionAction } from '@/lib/authz';

const SYSTEM = `You are Antagna's project risk analyzer for Volt Production (Saudi Arabia).
Given the project context, output STRICT JSON only:
{
  "risk": "green" | "amber" | "red",
  "status_paragraph": "<2-3 sentences Arabic — what's going on right now>",
  "next_action": "<1 sentence Arabic — concrete next thing to do>"
}

Be conservative:
- amber if delivery_due is < 7 days away and stage is earlier than 'editing'
- red if past due, blocked tasks > 0, or stuck in same stage > 7 days
- green if on track`;

/**
 * Re-analyze a project with Claude. Updates projects.ai_* columns.
 * Safe to call: throttles to once-per-15-minutes per project unless force=true.
 */
export async function reanalyzeProject(projectId: string, force = false) {
  const actorId = await requirePermissionAction('project.update');
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  // Pull project context
  const rows = (await db.execute<{
    id: string;
    code: string;
    title: string;
    title_ar: string | null;
    stage: string;
    pm_name: string | null;
    client_name: string | null;
    delivery_due_at: Date | null;
    shoot_starts_at: Date | null;
    contracted_value_sar: string | null;
    ai_analyzed_at: Date | null;
    open_tasks: number;
    blocked_tasks: number;
    deliverable_total: number;
    deliverable_delivered: number;
    days_in_stage: number;
    recent_activity: string | null;
  }>(sql`
    SELECT
      p.id::text, p.code, p.title, p.title_ar, p.stage::text AS stage,
      prof.display_name AS pm_name,
      c.name_ar AS client_name,
      p.delivery_due_at, p.shoot_starts_at,
      p.contracted_value_sar::text,
      p.ai_analyzed_at,
      (SELECT count(*)::int FROM project_tasks
        WHERE project_id = p.id AND status IN ('pending','in_progress')) AS open_tasks,
      (SELECT count(*)::int FROM project_tasks
        WHERE project_id = p.id AND status = 'blocked') AS blocked_tasks,
      (SELECT count(*)::int FROM deliverables WHERE project_id = p.id) AS deliverable_total,
      (SELECT count(*)::int FROM deliverables
        WHERE project_id = p.id AND status = 'delivered') AS deliverable_delivered,
      EXTRACT(EPOCH FROM (now() - p.updated_at))::int / 86400 AS days_in_stage,
      (
        SELECT string_agg(
          action || ': ' || COALESCE(summary_ar, summary_en, '?'),
          E'\n'
          ORDER BY created_at DESC
        )
        FROM (
          SELECT action, summary_ar, summary_en, created_at
          FROM activity_events
          WHERE entity_type = 'project' AND entity_id = p.id
          ORDER BY created_at DESC LIMIT 5
        ) recent
      ) AS recent_activity
    FROM projects p
    LEFT JOIN profiles prof ON prof.id = p.project_manager_id
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.id = ${projectId}::uuid
  `)) as unknown as Array<{
    id: string;
    code: string;
    title: string;
    title_ar: string | null;
    stage: string;
    pm_name: string | null;
    client_name: string | null;
    delivery_due_at: Date | null;
    shoot_starts_at: Date | null;
    contracted_value_sar: string | null;
    ai_analyzed_at: Date | null;
    open_tasks: number;
    blocked_tasks: number;
    deliverable_total: number;
    deliverable_delivered: number;
    days_in_stage: number;
    recent_activity: string | null;
  }>;

  const proj = rows[0];
  if (!proj) return { ok: false, error: 'not_found' };

  // Throttle: skip if analyzed < 15 minutes ago and not forced
  if (!force && proj.ai_analyzed_at) {
    const minsAgo =
      (Date.now() - new Date(proj.ai_analyzed_at).getTime()) / 60000;
    if (minsAgo < 15) {
      return { ok: true, skipped: true, minsAgo: Math.floor(minsAgo) };
    }
  }

  const prompt = `Project ${proj.code} — ${proj.title_ar ?? proj.title}
Client: ${proj.client_name ?? '?'}
PM: ${proj.pm_name ?? 'unassigned'}
Stage: ${proj.stage} (${proj.days_in_stage} days since last update)
Delivery due: ${proj.delivery_due_at ? new Date(proj.delivery_due_at).toISOString().slice(0, 10) : 'not set'}
Shoot starts: ${proj.shoot_starts_at ? new Date(proj.shoot_starts_at).toISOString().slice(0, 10) : 'not set'}
Value: ${proj.contracted_value_sar ?? 'not set'} SAR
Tasks: ${proj.open_tasks} open, ${proj.blocked_tasks} blocked
Deliverables: ${proj.deliverable_delivered}/${proj.deliverable_total} delivered

Recent activity:
${proj.recent_activity ?? '(no recent events)'}

Output JSON only.`;

  try {
    const anthropic = getAnthropic();
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = resp.content.find((b) => b.type === 'text');
    const raw = text && text.type === 'text' ? text.text : '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, error: 'no_json' };
    }
    const parsed = JSON.parse(jsonMatch[0]) as {
      risk: string;
      status_paragraph: string;
      next_action: string;
    };

    await recordUsage({
      feature: 'inline_reanalyze',
      model: ANTHROPIC_MODELS.sonnet,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
      authUserId: user.id,
    });

    await withActor(actorId, (tx) =>
      tx.execute(sql`
        UPDATE projects SET
          ai_risk_level = ${parsed.risk},
          ai_status_paragraph = ${parsed.status_paragraph},
          ai_next_action = ${parsed.next_action},
          ai_analyzed_at = now(),
          updated_at = now()
        WHERE id = ${projectId}::uuid
      `),
    );

    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/projects');
    revalidatePath('/dashboard');
    return { ok: true, risk: parsed.risk };
  } catch (err) {
    console.error('[reanalyzeProject]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}
