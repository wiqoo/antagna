'use server';

import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage, assertAiBudget } from '@antagna/ai';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermissionAction } from '@/lib/authz';
import { loadJobDescription, reportsToPosition, type JobDescription } from '@/lib/job-descriptions';
import { notify } from '@/lib/notify';

/** Monday (YYYY-MM-DD) of the current Asia/Riyadh week — the report period key.
 *  Module-private: a 'use server' file may only EXPORT async functions. */
function riyadhWeekStart(now: Date = new Date()): string {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const d = new Date(`${ymd}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow)); // back to Monday
  return d.toISOString().slice(0, 10);
}

export type WeeklyReportKpi = {
  key: string;
  label: string;
  value: number | null;
  target: number;
  unit: string;
  status: 'green' | 'amber' | 'red' | 'na';
  note?: string;
};
export type WeeklyReportContent = {
  headline: string;
  summary_ar: string;
  kpis: WeeklyReportKpi[];
  wins: string[];
  concerns: string[];
  focus_next_week: string[];
};
export type WeeklyReportRow = {
  id: string;
  weekStart: string;
  status: 'draft' | 'approved' | 'sent';
  positionTitle: string;
  generatedAt: string;
  approvedAt: string | null;
  sentAt: string | null;
  managerNameAr: string | null;
  content: WeeklyReportContent;
};

const WEEKLY_SYSTEM = `You write a weekly PERFORMANCE REPORT for one employee at Volt Production, a
Saudi production agency. You are given (1) the employee's JOB DESCRIPTION
(mission + responsibilities + KPIs with targets) and (2) a SNAPSHOT of their
actual system activity for the past 7 days. Grade the real activity against the
job description — this is accountability, not motivation.

Output STRICT JSON only (no markdown fences, no prose):
{
  "headline": "<Arabic, 5-9 words — the gist of the person's week>",
  "summary_ar": "<Arabic, 2-3 factual sentences summarizing the week vs their role>",
  "kpis": [
    {
      "key": "<the KPI key from the job description>",
      "label": "<Arabic KPI name>",
      "value": <number or null — the measured value from the snapshot, null if not measurable yet>,
      "target": <the target number>,
      "unit": "<pct|count|hours|days|sar|ratio>",
      "status": "green" | "amber" | "red" | "na",
      "note": "<short Arabic — what the number means / why this status>"
    }
  ],
  "wins": ["<Arabic — concrete things done well this week, tied to a responsibility>"],
  "concerns": ["<Arabic — responsibilities slipping or NOT done; be specific>"],
  "focus_next_week": ["<Arabic — 2-3 concrete priorities for next week>"]
}

RULES
- Compute KPI status by comparing the measured value to target + direction:
  direction 'higher' → green if value >= target, amber if within ~15% below,
  else red. direction 'lower' (e.g. response hours) → green if value <= target,
  amber if slightly above, else red. If the KPI is not measurable from the
  snapshot (no value), status MUST be "na" and value null, note "بانتظار البيانات".
- Include EVERY KPI from the job description, in order.
- wins/concerns must reference ACTUAL snapshot numbers (e.g. "سلّم ٣ مشاريع، اتنين في الموعد"),
  never generic praise. If the week was thin/empty, say so plainly.
- concerns = the honest gaps: overdue tasks, slow replies, missed responsibilities,
  no weekly report, etc. Lead with the most important.
- Arabic, internal-team register, direct, no honorifics, no fluff. Reference
  projects/clients by name, never by code. People by first name.
- 2-5 items max per list. Output JSON only.`;

type ActorInfo = { id: string; positionKey: string | null; displayName: string; authUserId: string };

async function gatherSnapshot(actorId: string): Promise<string> {
  const rows = (await db.execute<{ snapshot: string }>(sql`
    SELECT json_build_object(
      'projects_managed', (
        SELECT json_build_object(
          'active', count(*) FILTER (WHERE stage NOT IN ('delivered','archived','lost','cancelled')),
          'delivered_7d', count(*) FILTER (WHERE delivered_at >= now() - interval '7 days'),
          'delivered_7d_on_time', count(*) FILTER (
            WHERE delivered_at >= now() - interval '7 days'
              AND delivery_due_at IS NOT NULL AND delivered_at <= delivery_due_at),
          'overdue_now', count(*) FILTER (
            WHERE delivery_due_at < now() AND delivered_at IS NULL
              AND stage NOT IN ('delivered','archived','lost','cancelled')),
          'names', (SELECT json_agg(COALESCE(title_ar, title)) FROM (
            SELECT title_ar, title FROM projects p2
            WHERE p2.archived_at IS NULL
              AND (p2.project_manager_id = ${actorId}::uuid OR p2.account_manager_id = ${actorId}::uuid OR p2.production_manager_id = ${actorId}::uuid)
              AND p2.stage NOT IN ('delivered','archived','lost','cancelled')
            ORDER BY p2.delivery_due_at NULLS LAST LIMIT 8) s)
        )
        FROM projects p
        WHERE p.archived_at IS NULL
          AND (p.project_manager_id = ${actorId}::uuid OR p.account_manager_id = ${actorId}::uuid OR p.production_manager_id = ${actorId}::uuid)
      ),
      'tasks', (
        SELECT json_build_object(
          'completed_7d', count(*) FILTER (WHERE status='completed' AND completed_at >= now() - interval '7 days'),
          'overdue_now', count(*) FILTER (WHERE due_at < now() AND status NOT IN ('completed','cancelled')),
          'blocked_now', count(*) FILTER (WHERE status='blocked')
        )
        FROM project_tasks WHERE assignee_id = ${actorId}::uuid
      ),
      'approvals_done_7d', (
        SELECT count(*)::int FROM internal_approvals
        WHERE reviewer_profile_id = ${actorId}::uuid AND reviewed_at >= now() - interval '7 days'
      ),
      'leads', (
        SELECT json_build_object(
          'new_7d', count(*) FILTER (WHERE received_at >= now() - interval '7 days'),
          'open', count(*) FILTER (WHERE status IN ('new','qualified','nurturing','proposal_sent')),
          'proposal_sent', count(*) FILTER (WHERE status='proposal_sent'),
          'won', count(*) FILTER (WHERE status='won'),
          'total_90d', count(*) FILTER (WHERE received_at >= now() - interval '90 days'),
          'converted_90d', count(*) FILTER (WHERE converted_to_project_id IS NOT NULL AND received_at >= now() - interval '90 days')
        )
        FROM leads WHERE assigned_to_profile_id = ${actorId}::uuid
      ),
      'email', (
        SELECT json_build_object(
          'avg_first_response_hours', round(avg(hours_to_first_response)::numeric, 1),
          'awaiting_our_reply', count(*) FILTER (WHERE reply_state='awaiting_our_reply')
        )
        FROM v_email_communication_metrics WHERE assigned_profile_id = ${actorId}::uuid
      ),
      'shoots_attended_7d', (
        SELECT count(*)::int FROM attendance_records
        WHERE profile_id = ${actorId}::uuid AND type='check_in_shoot'
          AND server_timestamp >= now() - interval '7 days'
      )
    )::text AS snapshot
  `)) as unknown as Array<{ snapshot: string }>;
  return rows[0]?.snapshot ?? '{}';
}

async function getActor(): Promise<{ actor: ActorInfo; jd: JobDescription } | { error: string }> {
  const actorId = await requirePermissionAction('daily_task.manage_self');
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const rows = (await db.execute<{ position_key: string | null; display_name: string }>(sql`
    SELECT position_key, display_name FROM profiles WHERE id = ${actorId}::uuid
  `)) as unknown as Array<{ position_key: string | null; display_name: string }>;
  const positionKey = rows[0]?.position_key ?? null;
  const displayName = rows[0]?.display_name ?? '';
  const jd = loadJobDescription(positionKey);
  if (!jd) return { error: 'no_jd' };
  return { actor: { id: actorId, positionKey, displayName, authUserId: user.id }, jd };
}

/** Draft (or regenerate) the actor's weekly performance report for the current week. */
export async function generateWeeklyReport(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const got = await getActor();
  if ('error' in got) return { ok: false, error: got.error };
  const { actor, jd } = got;

  await assertAiBudget({ userId: actor.id, feature: 'weekly_report' });
  const weekStart = riyadhWeekStart();
  const snapshot = await gatherSnapshot(actor.id);

  const jdForAi = {
    role: jd.titleAr,
    mission: jd.missionAr,
    responsibilities: jd.responsibilities.map((r) => r.titleAr),
    kpis: jd.kpis.map((k) => ({
      key: k.key, label: k.titleAr, target: k.target, unit: k.unit,
      direction: k.direction, measurable: k.measurable,
    })),
  };

  try {
    const anthropic = getAnthropic();
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 1600,
      system: WEEKLY_SYSTEM,
      messages: [{
        role: 'user',
        content: `EMPLOYEE: ${actor.displayName}\n\nJOB DESCRIPTION:\n${JSON.stringify(jdForAi, null, 2)}\n\nACTIVITY SNAPSHOT (last 7 days):\n${snapshot}`,
      }],
    });
    const { costUsd } = await recordUsage({
      feature: 'weekly_report',
      model: ANTHROPIC_MODELS.sonnet,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
      authUserId: actor.authUserId,
    });

    const text = resp.content.find((b) => b.type === 'text');
    const raw = text && text.type === 'text' ? text.text : '{}';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, error: 'no_json' };
    const parsed = JSON.parse(match[0]) as WeeklyReportContent;

    await db.execute(sql`
      INSERT INTO weekly_reports
        (profile_id, week_start, position_key, content, highlights, status, model_used, cost_usd, generated_at)
      VALUES (
        ${actor.id}::uuid, ${weekStart}, ${actor.positionKey},
        ${parsed.headline ?? 'تقرير الأسبوع'}, ${JSON.stringify(parsed)}::jsonb,
        'draft', ${ANTHROPIC_MODELS.sonnet}, ${costUsd ?? 0}, now()
      )
      ON CONFLICT (profile_id, week_start) DO UPDATE
        SET content = EXCLUDED.content,
            highlights = EXCLUDED.highlights,
            edited_highlights = NULL,
            status = 'draft',
            model_used = EXCLUDED.model_used,
            cost_usd = EXCLUDED.cost_usd,
            generated_at = now(),
            approved_at = NULL, approved_by_id = NULL,
            sent_at = NULL, sent_to_manager_id = NULL
    `);

    revalidatePath('/performance');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

/** Load the actor's current-week report (with manager name resolved by position). */
export async function loadCurrentWeeklyReport(): Promise<WeeklyReportRow | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [actor] = await db
    .select({ id: profiles.id, positionKey: profiles.positionKey })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (!actor) return null;

  const weekStart = riyadhWeekStart();
  const rows = (await db.execute<{
    id: string; status: string; highlights: WeeklyReportContent | null;
    edited_highlights: WeeklyReportContent | null; generated_at: Date;
    approved_at: Date | null; sent_at: Date | null;
  }>(sql`
    SELECT id::text, status, highlights, edited_highlights, generated_at, approved_at, sent_at
    FROM weekly_reports
    WHERE profile_id = ${actor.id}::uuid AND week_start = ${weekStart}
    LIMIT 1
  `)) as unknown as Array<{
    id: string; status: string; highlights: WeeklyReportContent | null;
    edited_highlights: WeeklyReportContent | null; generated_at: Date;
    approved_at: Date | null; sent_at: Date | null;
  }>;
  const row = rows[0];
  if (!row) return null;
  const content = row.edited_highlights ?? row.highlights;
  if (!content) return null;

  const jd = loadJobDescription(actor.positionKey);
  const managerPos = reportsToPosition(actor.positionKey);
  let managerNameAr: string | null = null;
  if (managerPos) {
    const m = (await db.execute<{ display_name: string }>(sql`
      SELECT display_name FROM profiles
      WHERE position_key = ${managerPos} AND status = 'active' AND archived_at IS NULL
      ORDER BY created_at LIMIT 1
    `)) as unknown as Array<{ display_name: string }>;
    managerNameAr = m[0]?.display_name ?? null;
  }

  return {
    id: row.id,
    weekStart,
    status: row.status as WeeklyReportRow['status'],
    positionTitle: jd?.titleAr ?? '',
    generatedAt: new Date(row.generated_at).toISOString(),
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
    managerNameAr,
    content,
  };
}

/** Approve the current-week report and route it to the manager (reports_to). */
export async function approveAndSendWeeklyReport(
  edited?: WeeklyReportContent,
): Promise<{ ok: true; sentTo: string | null } | { ok: false; error: string }> {
  const actorId = await requirePermissionAction('daily_task.manage_self');
  const weekStart = riyadhWeekStart();

  const rows = (await db.execute<{ id: string; position_key: string | null; display_name: string }>(sql`
    SELECT wr.id::text, wr.position_key, p.display_name
    FROM weekly_reports wr JOIN profiles p ON p.id = wr.profile_id
    WHERE wr.profile_id = ${actorId}::uuid AND wr.week_start = ${weekStart}
    LIMIT 1
  `)) as unknown as Array<{ id: string; position_key: string | null; display_name: string }>;
  const row = rows[0];
  if (!row) return { ok: false, error: 'no_report' };

  // Resolve the manager by the JD reports_to position → the active holder.
  const managerPos = reportsToPosition(row.position_key);
  let managerId: string | null = null;
  let managerName: string | null = null;
  if (managerPos) {
    const m = (await db.execute<{ id: string; display_name: string }>(sql`
      SELECT id::text, display_name FROM profiles
      WHERE position_key = ${managerPos} AND status = 'active' AND archived_at IS NULL
        AND id <> ${actorId}::uuid
      ORDER BY created_at LIMIT 1
    `)) as unknown as Array<{ id: string; display_name: string }>;
    managerId = m[0]?.id ?? null;
    managerName = m[0]?.display_name ?? null;
  }

  await db.execute(sql`
    UPDATE weekly_reports
    SET status = ${managerId ? 'sent' : 'approved'},
        edited_highlights = ${edited ? sql`${JSON.stringify(edited)}::jsonb` : sql`edited_highlights`},
        approved_by_id = ${actorId}::uuid, approved_at = now(),
        sent_to_manager_id = ${managerId ? sql`${managerId}::uuid` : null},
        sent_at = ${managerId ? sql`now()` : null}
    WHERE id = ${row.id}::uuid
  `);

  if (managerId) {
    await notify({
      recipientId: managerId,
      event: 'on_alert',
      content: {
        ar: { title: `تقرير أداء أسبوعي — ${row.display_name}`, body: 'اعتمد تقريره الأسبوعي وأرسله لك للاطّلاع.' },
        en: { title: `Weekly report — ${row.display_name}`, body: 'Approved and sent their weekly report.' },
      },
      linkUrl: '/performance',
      entityType: 'weekly_report',
      entityId: row.id,
      metadata: { kind: 'weekly_report', personId: actorId },
    }).catch((e) => console.error('[weekly-report] notify manager failed', e));
  }

  revalidatePath('/performance');
  return { ok: true, sentTo: managerName };
}
