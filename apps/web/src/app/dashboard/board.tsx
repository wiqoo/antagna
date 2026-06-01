/**
 * Shared dashboard card-board builder.
 *
 * Extracted so BOTH the full dashboard (`/dashboard`) and the per-position
 * "My Day" home (`/my-day`) render the *same* card board from the *same* data
 * + the same per-position layout — without duplicating the (large) set of
 * queries or the row→card mapping. Callers pass the effective (view-as aware)
 * profile id + legacy role; this returns server-rendered card nodes keyed by
 * id, the resolved layout (cookie → position default → role default), and the
 * live card count. The grid orders/sizes/shows-hides them client-side.
 *
 * Card data wiring mirrors what `/dashboard` shipped — see the per-query
 * comments. Every query is wrapped in a timeout + try/catch so one slow/broken
 * query never blocks the board.
 */
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  CardGlance, CardEmailTriage, CardSmartSuggestions, CardProjectHealth,
  CardCapacityForecast, CardApprovals, CardStaleConvos, CardTodayShoots,
  CardEquipmentConflicts, CardMTDRevenue, CardAtRisk,
  resolveLayout, DASH_LAYOUT_COOKIE, type CardId, type DashLayout,
} from './cards';

const WEEKDAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export type DashboardBoard = {
  items: { id: CardId; node: ReactNode }[];
  layout: DashLayout;
  catalogCount: number;
};

export async function buildDashboardBoard({
  profileId,
  role,
  canFinance = false,
}: {
  profileId: string | null;
  role: string | null | undefined;
  /** financials.read — resolved at the PAGE level (before the streamed board's
   *  query storm) and passed in, so the board never runs an unprotected can()
   *  query that could hang on a starved pool. */
  canFinance?: boolean;
}): Promise<DashboardBoard> {
  const QUERY_TIMEOUT_MS = 6000;
  const safe = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await Promise.race<T>([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error(`board:${label} timed out after ${QUERY_TIMEOUT_MS}ms`)),
            QUERY_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (err) {
      console.error(`[board:${label}]`, err);
      return fallback;
    }
  };

  const [
    statsRow,
    shootsArr,
    deliverablesQueueArr,
    teamLoadArr,
    budgetBurnArr,
    conflictsArr,
    commHealthRow,
    pendingSuggestionsArr,
    recentThreadsArr,
    staleFollowupsArr,
  ] = await Promise.all([
    safe('stats', () => db.execute<{
      active_projects: number; open_tasks: number; open_leads: number;
      equipment_count: number; mtd_revenue: string | null; overdue_count: number;
      pending_review_count: number;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM projects
          WHERE stage NOT IN ('delivered','archived','lost','cancelled')
            AND archived_at IS NULL) AS active_projects,
        (SELECT count(*)::int FROM project_tasks
          WHERE status IN ('pending','in_progress')) AS open_tasks,
        (SELECT count(*)::int FROM leads
          WHERE status IN ('new','qualified','nurturing')) AS open_leads,
        (SELECT count(*)::int FROM equipment
          WHERE archived_at IS NULL) AS equipment_count,
        (SELECT COALESCE(SUM(contracted_value_sar),0)::text FROM projects
          WHERE delivered_at >= date_trunc('month', now())) AS mtd_revenue,
        (SELECT count(*)::int FROM projects
          WHERE delivery_due_at IS NOT NULL
            AND delivery_due_at < now()
            AND stage NOT IN ('delivered','archived','lost','cancelled')) AS overdue_count,
        (SELECT count(*)::int FROM deliverables
          WHERE status IN ('pending_director','pending_am','in_client_review')) AS pending_review_count
    `), [] as Array<{ active_projects: number; open_tasks: number; open_leads: number; equipment_count: number; mtd_revenue: string | null; overdue_count: number; pending_review_count: number }>),

    safe('shoots', () => db.execute<{
      id: string; code: string; title_ar: string | null; title: string; stage: string;
      starts_at: Date; client_name: string | null; city: string | null;
    }>(sql`
      SELECT p.id::text, p.code, p.title_ar, p.title, p.stage::text AS stage,
             p.shoot_starts_at AS starts_at,
             c.name_ar AS client_name, c.city AS city
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.shoot_starts_at IS NOT NULL
        AND p.shoot_starts_at >= now()
        AND p.shoot_starts_at < now() + interval '7 days'
        AND p.archived_at IS NULL
      ORDER BY p.shoot_starts_at
      LIMIT 6
    `), [] as Array<{ id: string; code: string; title_ar: string | null; title: string; stage: string; starts_at: Date; client_name: string | null; city: string | null }>),

    safe('deliverables', () => db.execute<{
      id: string; project_id: string; project_code: string; item_number: string | null;
      title: string | null; status: string; group_name: string;
    }>(sql`
      SELECT d.id::text, d.project_id::text, p.code AS project_code,
             d.item_number, d.title, d.status::text AS status,
             dg.name_ar AS group_name
      FROM deliverables d
      INNER JOIN projects p ON p.id = d.project_id
      INNER JOIN deliverable_groups dg ON dg.id = d.group_id
      WHERE d.status IN ('pending_director','pending_am','in_client_review','client_ready')
      ORDER BY d.updated_at DESC
      LIMIT 8
    `), [] as Array<{ id: string; project_id: string; project_code: string; item_number: string | null; title: string | null; status: string; group_name: string }>),

    safe('teamLoad', () => db.execute<{
      profile_id: string; name: string; day_offset: number; load: number;
    }>(sql`
      SELECT prof.id::text AS profile_id, prof.display_name AS name,
             ofs.d AS day_offset,
             count(DISTINCT pa.project_id)::int AS load
      FROM profiles prof
      CROSS JOIN generate_series(0, 13) AS ofs(d)
      LEFT JOIN project_assignments pa ON pa.profile_id = prof.id
      LEFT JOIN projects p ON p.id = pa.project_id
        AND p.stage NOT IN ('delivered','archived','lost','cancelled')
        AND p.archived_at IS NULL
        AND (
          (p.shoot_starts_at IS NULL AND ofs.d < 7)
          OR
          (p.shoot_starts_at <= now() + (ofs.d * interval '1 day')
            AND COALESCE(p.shoot_ends_at, p.delivery_due_at, p.shoot_starts_at)
                >= now() + (ofs.d * interval '1 day'))
        )
      WHERE prof.status = 'active'
        AND prof.archived_at IS NULL
      GROUP BY prof.id, prof.display_name, ofs.d
      ORDER BY prof.display_name, ofs.d
    `), [] as Array<{ profile_id: string; name: string; day_offset: number; load: number }>),

    safe('budgetBurn', () => db.execute<{
      id: string; code: string; title_ar: string | null; title: string; stage: string;
      days_until_due: number; contracted_value: string | null; open_tasks: number; delivered_pct: number;
    }>(sql`
      SELECT p.id::text, p.code, p.title_ar, p.title,
             p.stage::text AS stage,
             EXTRACT(EPOCH FROM (p.delivery_due_at - now()))::int / 86400 AS days_until_due,
             p.contracted_value_sar::text AS contracted_value,
             (SELECT count(*)::int FROM project_tasks
                WHERE project_id = p.id AND status IN ('pending','in_progress')) AS open_tasks,
             (
               SELECT CASE WHEN count(*) = 0 THEN 100
                           ELSE (count(*) FILTER (WHERE status = 'delivered')::numeric
                                 / count(*)::numeric * 100)::int
                       END
               FROM deliverables WHERE project_id = p.id
             ) AS delivered_pct
      FROM projects p
      WHERE p.archived_at IS NULL
        AND p.delivery_due_at IS NOT NULL
        AND p.stage NOT IN ('delivered','archived','lost','cancelled')
        AND p.delivery_due_at < now() + interval '14 days'
      ORDER BY p.delivery_due_at
      LIMIT 6
    `), [] as Array<{ id: string; code: string; title_ar: string | null; title: string; stage: string; days_until_due: number; contracted_value: string | null; open_tasks: number; delivered_pct: number }>),

    safe('conflicts', () => db.execute<{
      equipment_id: string; code: string; model: string; overlap_starts_at: Date; conflicting: number;
    }>(sql`
      WITH conflicts AS (
        SELECT r1.equipment_id, MIN(r1.starts_at) AS overlap_starts_at,
               count(*) AS conflicting
        FROM equipment_reservations r1
        WHERE r1.equipment_id IS NOT NULL
          AND r1.status != 'cancelled'
          AND r1.starts_at < now() + interval '14 days'
          AND r1.ends_at > now()
          AND EXISTS (
            SELECT 1 FROM equipment_reservations r2
            WHERE r2.equipment_id = r1.equipment_id
              AND r2.id != r1.id
              AND r2.status != 'cancelled'
              AND r2.starts_at < r1.ends_at
              AND r2.ends_at > r1.starts_at
          )
        GROUP BY r1.equipment_id
      )
      SELECT c.equipment_id::text, e.code, e.model,
             c.overlap_starts_at, c.conflicting::int
      FROM conflicts c
      INNER JOIN equipment e ON e.id = c.equipment_id
      LIMIT 5
    `), [] as Array<{ equipment_id: string; code: string; model: string; overlap_starts_at: Date; conflicting: number }>),

    safe('commHealth', () => db.execute<{
      awaiting_our_reply: number; awaiting_their_reply: number; active_threads: number;
    }>(sql`
      SELECT
        count(*) FILTER (WHERE reply_state = 'awaiting_our_reply')::int  AS awaiting_our_reply,
        count(*) FILTER (WHERE reply_state = 'awaiting_their_reply')::int AS awaiting_their_reply,
        count(*)::int AS active_threads
      FROM v_email_communication_metrics
      WHERE last_message_at > now() - interval '30 days'
    `), [] as Array<{ awaiting_our_reply: number; awaiting_their_reply: number; active_threads: number }>),

    safe('pendingSuggestions', () => db.execute<{
      id: string; suggestion_type: string; summary_ar: string | null; confidence: number; thread_subject: string | null;
    }>(sql`
      SELECT s.id::text, s.suggestion_type::text AS suggestion_type,
             s.summary_ar, s.confidence::float AS confidence,
             t.subject AS thread_subject
      FROM ai_suggestions s
      LEFT JOIN email_threads t ON t.id = s.source_thread_id
      WHERE s.status = 'pending' AND s.expires_at > now()
      ORDER BY s.confidence DESC, s.created_at DESC
      LIMIT 5
    `), [] as Array<{ id: string; suggestion_type: string; summary_ar: string | null; confidence: number; thread_subject: string | null }>),

    safe('recentThreads', () => db.execute<{
      id: string; subject: string | null; ai_summary: string | null; last_from: string | null; last_message_at: Date;
    }>(sql`
      SELECT t.id::text, t.subject, t.ai_summary,
             (
               SELECT COALESCE(m.from_name, m.from_email)
               FROM email_messages m
               WHERE m.thread_id = t.id
               ORDER BY m.sent_at DESC
               LIMIT 1
             ) AS last_from,
             t.last_message_at
      FROM email_threads t
      WHERE t.last_message_at > now() - interval '14 days'
        AND t.status != 'closed'
      ORDER BY t.last_message_at DESC
      LIMIT 5
    `), [] as Array<{ id: string; subject: string | null; ai_summary: string | null; last_from: string | null; last_message_at: Date }>),

    safe('staleFollowups', () => db.execute<{
      thread_id: string; subject: string | null; hours: number;
    }>(sql`
      SELECT vm.thread_id::text AS thread_id, vm.subject,
             vm.hours_since_last_outbound::float AS hours
      FROM v_email_communication_metrics vm
      WHERE vm.reply_state = 'awaiting_their_reply'
        AND vm.hours_since_last_outbound > 120
      ORDER BY vm.hours_since_last_outbound DESC
      LIMIT 5
    `), [] as Array<{ thread_id: string; subject: string | null; hours: number }>),
  ]);

  const stats = ((statsRow as unknown as Array<{
    active_projects: number; open_tasks: number; open_leads: number; equipment_count: number;
    mtd_revenue: string | null; overdue_count: number; pending_review_count: number;
  }>)[0]) ?? {
    active_projects: 0, open_tasks: 0, open_leads: 0, equipment_count: 0,
    mtd_revenue: null, overdue_count: 0, pending_review_count: 0,
  };

  const shoots = shootsArr as unknown as Array<{
    id: string; code: string; title_ar: string | null; title: string;
    stage: string; starts_at: Date; client_name: string | null; city: string | null;
  }>;
  const deliverablesQueue = deliverablesQueueArr as unknown as Array<{
    id: string; project_id: string; project_code: string; item_number: string | null;
    title: string | null; status: string; group_name: string;
  }>;
  const teamLoad = teamLoadArr as unknown as Array<{
    profile_id: string; name: string; day_offset: number; load: number;
  }>;
  const budgetBurn = budgetBurnArr as unknown as Array<{
    id: string; code: string; title_ar: string | null; title: string; stage: string;
    days_until_due: number; contracted_value: string | null; open_tasks: number; delivered_pct: number;
  }>;
  const conflicts = conflictsArr as unknown as Array<{
    equipment_id: string; code: string; model: string; overlap_starts_at: Date; conflicting: number;
  }>;
  const commHealth = ((commHealthRow as unknown as Array<{
    awaiting_our_reply: number; awaiting_their_reply: number; active_threads: number;
  }>)[0]) ?? { awaiting_our_reply: 0, awaiting_their_reply: 0, active_threads: 0 };
  const pendingSuggestions = pendingSuggestionsArr as unknown as Array<{
    id: string; suggestion_type: string; summary_ar: string | null; confidence: number; thread_subject: string | null;
  }>;
  const recentThreads = recentThreadsArr as unknown as Array<{
    id: string; subject: string | null; ai_summary: string | null; last_from: string | null; last_message_at: Date;
  }>;
  const staleFollowups = staleFollowupsArr as unknown as Array<{
    thread_id: string; subject: string | null; hours: number;
  }>;

  // ── Layout (cookie → position default → role default) ──────────────────────
  const jar = await cookies();
  let storedLayout: Partial<DashLayout> | null = null;
  const raw = jar.get(DASH_LAYOUT_COOKIE)?.value;
  if (raw) {
    try { storedLayout = JSON.parse(raw) as Partial<DashLayout>; } catch { storedLayout = null; }
  }
  let positionKey: string | null = null;
  if (profileId) {
    // Wrapped in safe() so a starved-pool stall can't hang the streamed render
    // (this was the last unprotected query in the board path).
    const posRows = await safe(
      'positionKey',
      () =>
        db.execute<{ position_key: string | null }>(
          sql`SELECT position_key FROM profiles WHERE id = ${profileId}::uuid`,
        ),
      [] as unknown as Awaited<ReturnType<typeof db.execute>>,
    );
    positionKey = (posRows as unknown as { position_key: string | null }[])[0]?.position_key ?? null;
  }
  const layout = resolveLayout(storedLayout, role, positionKey);

  // ── Pivot team load → per-person 14-day arrays ─────────────────────────────
  type PersonRow = { profileId: string; name: string; days: number[] };
  const peopleMap = new Map<string, PersonRow>();
  for (const r of teamLoad) {
    let p = peopleMap.get(r.profile_id);
    if (!p) {
      p = { profileId: r.profile_id, name: r.name, days: new Array(14).fill(0) };
      peopleMap.set(r.profile_id, p);
    }
    p.days[r.day_offset] = r.load;
  }
  const people = Array.from(peopleMap.values()).filter((p) => p.days.some((d) => d > 0));

  // ── Map rows → card data ───────────────────────────────────────────────────
  const sum = (a: number[]) => a.reduce((s, d) => s + d, 0);
  // Financial figures only for holders of financials.read (canFinance is passed
  // in from the page). Without it the MTD revenue value is never computed into
  // the payload AND the card is dropped from items[] below, so it can't be
  // revealed via the add-card picker either.
  const mtdRevenue = canFinance && stats?.mtd_revenue ? Number(stats.mtd_revenue) : 0;

  function projectSignal(p: typeof budgetBurn[number]) {
    const overdue = p.days_until_due < 0;
    let score = overdue ? 90 : p.days_until_due < 3 ? 70 : p.days_until_due < 7 ? 50 : 30;
    if (p.delivered_pct < 30) score += 9;
    else if (p.delivered_pct < 60) score += 4;
    score = Math.min(99, score);
    const why = overdue
      ? `متأخر ${Math.abs(p.days_until_due)}ي`
      : p.delivered_pct < 40
        ? `إنجاز ${p.delivered_pct}٪`
        : `تسليم خلال ${p.days_until_due}ي`;
    const health: 'red' | 'amber' | 'green' = overdue
      ? 'red'
      : p.days_until_due < 3 || p.delivered_pct < 30
        ? 'amber'
        : 'green';
    return { score, why, health };
  }

  const glanceData = {
    active: stats.active_projects,
    tasks: stats.open_tasks,
    leads: stats.open_leads,
    review: stats.pending_review_count,
  };

  const staleThreadIds = new Set(staleFollowups.map((s) => s.thread_id));
  const emailTriageData = {
    awaitingOurReply: commHealth.awaiting_our_reply,
    urgent: staleFollowups.length,
    items: recentThreads.map((t) => ({
      who: t.last_from ?? 'إيميل',
      what: t.subject ?? t.ai_summary ?? '—',
      priority: (staleThreadIds.has(t.id) ? 'high' : 'med') as 'critical' | 'high' | 'med',
      href: '/inbox',
    })),
  };

  const suggestionsData = {
    pending: pendingSuggestions.length,
    items: pendingSuggestions.map((s) => ({
      type: s.suggestion_type.replace(/_/g, ' '),
      text: s.summary_ar ?? s.thread_subject ?? '—',
      confidence: Math.round(s.confidence * 100),
    })),
  };

  const projectHealthData = {
    analyzed: stats.active_projects,
    items: budgetBurn.map((p) => {
      const sig = projectSignal(p);
      return { name: p.title_ar ?? p.title, health: sig.health, why: sig.why, pct: p.delivered_pct, href: `/projects/${p.id}` };
    }),
  };

  const atRiskItems = budgetBurn
    .map((p) => {
      const sig = projectSignal(p);
      return { name: p.title_ar ?? p.title, score: sig.score, why: sig.why, href: `/projects/${p.id}` };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const atRiskData = { confidence: atRiskItems[0]?.score, items: atRiskItems };

  const capPeople = [...people]
    .sort((a, b) => sum(b.days) - sum(a.days))
    .slice(0, 6)
    .map((p) => ({ name: p.name, days: p.days }));
  const overloaded = capPeople.find((p) => sum(p.days) > 28);
  const capacityData = {
    note: overloaded ? `${overloaded.name} فوق سقف الحمولة` : undefined,
    people: capPeople,
  };

  const approvalsData = {
    items: deliverablesQueue.map((d) => ({
      what: d.title ?? '(بدون عنوان)',
      sub: d.group_name,
      href: `/projects/${d.project_id}`,
    })),
  };

  const staleConvosData = {
    items: staleFollowups.map((s) => ({
      client: s.subject ?? '(بدون عنوان)',
      why: 'ننتظر ردهم',
      days: Math.floor(s.hours / 24),
      href: '/inbox',
    })),
  };

  const shootsData = {
    count: shoots.length,
    conflicts: 0,
    items: shoots.map((s) => {
      const d = new Date(s.starts_at);
      const time = d.toISOString().slice(11, 16);
      const daysFromNow = Math.floor((d.getTime() - Date.now()) / 86_400_000);
      const isToday = daysFromNow === 0;
      const when = isToday
        ? `اليوم ${time}`
        : daysFromNow === 1
          ? `غداً ${time}`
          : `${WEEKDAYS_AR[d.getUTCDay()]} ${time}`;
      return { when, what: s.title_ar ?? s.title, city: s.city ?? '—', isToday, conflict: false, href: `/projects/${s.id}` };
    }),
  };

  const conflictsData = {
    count: conflicts.length,
    items: conflicts.slice(0, 3).map((c) => ({
      label: c.model,
      detail: `${c.conflicting} حجز · ${new Date(c.overlap_starts_at).toISOString().slice(0, 10)}`,
    })),
  };

  const revenueData = { value: mtdRevenue };

  const items: { id: CardId; node: ReactNode }[] = [
    { id: 'glance', node: <CardGlance data={glanceData} /> },
    { id: 'email_triage', node: <CardEmailTriage data={emailTriageData} /> },
    { id: 'ai_suggestions', node: <CardSmartSuggestions data={suggestionsData} /> },
    { id: 'project_health', node: <CardProjectHealth data={projectHealthData} /> },
    // capacity_fc (حمولة الفريق) removed — retired per owner.
    { id: 'approvals', node: <CardApprovals data={approvalsData} /> },
    { id: 'stale_convos', node: <CardStaleConvos data={staleConvosData} /> },
    { id: 'shoots', node: <CardTodayShoots data={shootsData} /> },
    { id: 'equip_conflicts', node: <CardEquipmentConflicts data={conflictsData} /> },
    // Revenue card only for financials.read holders — not in the payload/picker otherwise.
    ...(canFinance
      ? [{ id: 'mtd_revenue' as CardId, node: <CardMTDRevenue data={revenueData} /> }]
      : []),
    { id: 'at_risk', node: <CardAtRisk data={atRiskData} /> },
  ];

  return { items, layout, catalogCount: items.length };
}
