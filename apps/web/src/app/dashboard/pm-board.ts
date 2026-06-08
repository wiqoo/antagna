/**
 * Project-Manager board data — the per-PM queries that feed the PM cards.
 *
 * Pure data (no JSX): runs a handful of queries scoped to the signed-in PM and
 * returns serializable card payloads, so it caches with the rest of the board.
 * Each query is timeout+catch guarded; a failure degrades that one card to
 * empty rather than breaking the board.
 */
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import type { PmListData, PmStatsData, PmFunnelData, PmRow } from './cards/pm-cards';

export type PmBoardData = {
  pipeline: PmFunnelData;
  deals: PmListData;
  response: PmListData;
  approvals: PmListData;
  atRisk: PmListData;
  handoff: PmListData;
  onTime: PmStatsData;
  weekly: PmStatsData;
  docGap: PmListData;
};

const TIMEOUT_MS = 5000;
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race<T>([
      fn(),
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`pm:${label} timeout`)), TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.error(`[pm-board:${label}]`, e);
    return fallback;
  }
}

/** Monday (YYYY-MM-DD) of the current Asia/Riyadh week — matches weekly_reports. */
function riyadhWeekStart(): string {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const d = new Date(`${ymd}T00:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

const rows = <T,>(r: unknown): T[] => r as unknown as T[];
const fmtMoney = (n: number) => `${Math.round(n).toLocaleString('en-US')} ر.س`;
const ageDays = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : 0);

export async function gatherPmCards(profileId: string): Promise<PmBoardData> {
  const weekStart = riyadhWeekStart();

  const [leadsRows, activeProjRows, onTimeRow, apprRows, emailRows, weeklyRow, docGapRows] = await Promise.all([
    // 1) leads owned by me — feeds pipeline funnel + deals-to-close
    safe('leads', () => db.execute(sql`
      SELECT l.id::text AS id, l.status::text AS status,
             COALESCE(l.estimated_value_sar, 0)::float8 AS value,
             l.received_at, l.updated_at, l.lost_at,
             COALESCE(c.name_ar, l.unmatched_from_name, 'عميل محتمل') AS name
      FROM leads l LEFT JOIN clients c ON c.id = l.client_id
      WHERE l.assigned_to_profile_id = ${profileId}::uuid
    `), [] as unknown[]).then(rows<{ id: string; status: string; value: number; received_at: string | null; updated_at: string | null; lost_at: string | null; name: string }>),

    // 2) my active projects — feeds at-risk + handoff
    safe('activeProjects', () => db.execute(sql`
      SELECT p.id::text AS id, COALESCE(p.title_ar, p.title) AS name, p.stage::text AS stage,
             p.delivery_due_at, p.approved_at, p.shoot_starts_at, p.production_manager_id::text AS pm_id,
             p.ai_next_action,
             EXTRACT(EPOCH FROM (p.delivery_due_at - now()))::int / 86400 AS days_until_due,
             (SELECT CASE WHEN count(*)=0 THEN 0 ELSE (count(*) FILTER (WHERE status='delivered')::numeric / count(*)::numeric * 100)::int END
              FROM deliverables WHERE project_id = p.id) AS delivered_pct
      FROM projects p
      WHERE p.project_manager_id = ${profileId}::uuid AND p.archived_at IS NULL
        AND p.stage NOT IN ('delivered','archived','lost','cancelled')
      ORDER BY p.delivery_due_at NULLS LAST
    `), [] as unknown[]).then(rows<{ id: string; name: string; stage: string; delivery_due_at: string | null; approved_at: string | null; shoot_starts_at: string | null; pm_id: string | null; ai_next_action: string | null; days_until_due: number | null; delivered_pct: number }>),

    // 3) on-time delivery aggregate (last 90d)
    safe('onTime', () => db.execute(sql`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE delivered_at <= delivery_due_at)::int AS on_time
      FROM projects
      WHERE project_manager_id = ${profileId}::uuid
        AND delivered_at IS NOT NULL AND delivery_due_at IS NOT NULL
        AND delivered_at > now() - interval '90 days'
    `), [] as unknown[]).then((r) => rows<{ total: number; on_time: number }>(r)[0] ?? { total: 0, on_time: 0 }),

    // 4) approvals waiting on me as reviewer
    safe('approvals', () => db.execute(sql`
      SELECT ia.id::text AS id, COALESCE(d.title, 'عنصر تسليم') AS title,
             COALESCE(p.title_ar, p.title) AS project, p.id::text AS project_id,
             EXTRACT(EPOCH FROM (now() - ia.submitted_at)) / 3600 AS hours,
             ia.sla_hours
      FROM internal_approvals ia
      LEFT JOIN deliverables d ON d.id = ia.deliverable_id
      LEFT JOIN projects p ON p.id = d.project_id
      WHERE ia.reviewer_profile_id = ${profileId}::uuid AND ia.status = 'pending'
      ORDER BY ia.submitted_at ASC LIMIT 8
    `), [] as unknown[]).then(rows<{ id: string; title: string; project: string | null; project_id: string | null; hours: number; sla_hours: number | null }>),

    // 5) client emails awaiting MY reply (KPI: <2h)
    safe('email', () => db.execute(sql`
      SELECT vm.thread_id::text AS id, vm.subject,
             vm.hours_since_last_inbound::float8 AS hours
      FROM v_email_communication_metrics vm
      WHERE vm.assigned_profile_id = ${profileId}::uuid AND vm.reply_state = 'awaiting_our_reply'
      ORDER BY vm.hours_since_last_inbound DESC NULLS LAST LIMIT 8
    `), [] as unknown[]).then(rows<{ id: string; subject: string | null; hours: number | null }>),

    // 6) my weekly report status for this week
    safe('weekly', () => db.execute(sql`
      SELECT status FROM weekly_reports WHERE profile_id = ${profileId}::uuid AND week_start = ${weekStart} LIMIT 1
    `), [] as unknown[]).then((r) => rows<{ status: string }>(r)[0] ?? null),

    // 7) documentation gap — my active projects with recent WhatsApp but no
    //    matching recent email (the JD wants decisions documented by email).
    safe('docGap', () => db.execute(sql`
      SELECT p.id::text AS id, COALESCE(p.title_ar, p.title) AS name,
             max(w.received_at) AS last_wa,
             (SELECT max(t.last_message_at) FROM email_threads t WHERE t.project_id = p.id) AS last_email
      FROM projects p
      JOIN whatsapp_messages w ON w.project_id = p.id
      WHERE p.project_manager_id = ${profileId}::uuid AND p.archived_at IS NULL
        AND p.stage NOT IN ('delivered','archived','lost','cancelled')
        AND w.received_at > now() - interval '21 days'
      GROUP BY p.id, p.title_ar, p.title
      ORDER BY max(w.received_at) DESC LIMIT 12
    `), [] as unknown[]).then(rows<{ id: string; name: string; last_wa: string | null; last_email: string | null }>),
  ]);

  // ── pipeline funnel + conversion KPIs ──────────────────────────────────────
  const byStatus = (s: string[]) => leadsRows.filter((l) => s.includes(l.status));
  const valOf = (arr: typeof leadsRows) => arr.reduce((t, l) => t + (l.value || 0), 0);
  const newL = byStatus(['new']);
  const qualL = byStatus(['qualified', 'nurturing']);
  const propL = byStatus(['proposal_sent']);
  const wonL = leadsRows.filter((l) => l.status === 'won' && ageDays(l.received_at) <= 90);
  const proposalReached = leadsRows.filter((l) => ['proposal_sent', 'won'].includes(l.status)).length;
  const decided = leadsRows.filter((l) => ['proposal_sent', 'won', 'lost', 'ghosted'].includes(l.status)).length;
  const funnelEntered = leadsRows.filter((l) => l.status !== 'lost').length || 1;
  const lead2prop = Math.round((proposalReached / funnelEntered) * 100);
  const prop2deal = decided ? Math.round((wonL.length / decided) * 100) : 0;
  const rag = (v: number, target: number): 'green' | 'amber' | 'red' => (v >= target ? 'green' : v >= target * 0.85 ? 'amber' : 'red');

  const pipeline: PmFunnelData = {
    title: '// pipeline_funnel', ai: 'none', footer: 'مراحل صفقاتك ومعدّلات التحويل',
    stages: [
      { label: 'جديد', count: newL.length, value: valOf(newL) ? fmtMoney(valOf(newL)) : undefined },
      { label: 'مؤهّل', count: qualL.length, value: valOf(qualL) ? fmtMoney(valOf(qualL)) : undefined },
      { label: 'عرض مُرسل', count: propL.length, value: valOf(propL) ? fmtMoney(valOf(propL)) : undefined },
      { label: 'فوز (٩٠ي)', count: wonL.length, value: valOf(wonL) ? fmtMoney(valOf(wonL)) : undefined },
    ],
    kpis: [
      { label: 'تحويل لعرض', value: `${lead2prop}٪`, target: '٤٠٪', status: leadsRows.length ? rag(lead2prop, 40) : 'na' },
      { label: 'تحويل لصفقة', value: `${prop2deal}٪`, target: '٥٠٪', status: decided ? rag(prop2deal, 50) : 'na' },
    ],
  };

  // ── deals to close (proposal_sent, by value, with age) ─────────────────────
  const deals: PmListData = {
    title: '// deals_to_close', ai: 'none', empty: 'لا عروض منتظرة قرار العميل',
    footer: propL.length ? `${fmtMoney(valOf(propL))} على الطاولة` : undefined,
    items: [...propL].sort((a, b) => b.value - a.value).slice(0, 6).map((l): PmRow => {
      const age = ageDays(l.updated_at ?? l.received_at);
      return { primary: l.name, secondary: l.value ? fmtMoney(l.value) : undefined, metric: `${age}ي`, tone: age > 7 ? 'red' : age > 3 ? 'amber' : 'dim', href: '/crm' };
    }),
  };

  // ── client response overdue (>2h = red) ────────────────────────────────────
  const overTarget = emailRows.filter((e) => (e.hours ?? 0) > 2).length;
  const response: PmListData = {
    title: '// client_response_overdue', ai: 'light', empty: 'كل العملاء مردود عليهم ✓',
    footer: emailRows.length ? `${overTarget} تجاوزت الساعتين` : undefined,
    items: emailRows.map((e): PmRow => {
      const h = e.hours ?? 0;
      const metric = h >= 24 ? `${Math.floor(h / 24)}ي` : `${Math.round(h)}س`;
      return { primary: e.subject ?? '(بدون عنوان)', secondary: 'ينتظر ردّك', metric, tone: h > 2 ? 'red' : 'amber', href: `/inbox/${e.id}` };
    }),
  };

  // ── approvals on my desk (SLA timers) ──────────────────────────────────────
  const breached = apprRows.filter((a) => a.sla_hours != null && a.hours > a.sla_hours).length;
  const approvals: PmListData = {
    title: '// my_approvals', ai: 'none', empty: 'لا مراجعات على طاولتك',
    footer: apprRows.length ? `${apprRows.length} منتظرة${breached ? ` · ${breached} تجاوزت المهلة` : ''}` : undefined,
    items: apprRows.map((a): PmRow => {
      const h = a.hours;
      const over = a.sla_hours != null && h > a.sla_hours;
      const metric = h >= 24 ? `${Math.floor(h / 24)}ي` : `${Math.round(h)}س`;
      return { primary: a.title, secondary: a.project ?? undefined, metric, tone: over ? 'red' : h > 12 ? 'amber' : 'dim', href: a.project_id ? `/projects/${a.project_id}` : undefined };
    }),
  };

  // ── at-risk delivery (AI next action) ──────────────────────────────────────
  const riskScore = (p: typeof activeProjRows[number]) => {
    const dd = p.days_until_due ?? 99;
    let s = dd < 0 ? 90 : dd < 3 ? 70 : dd < 7 ? 45 : 20;
    if (p.delivered_pct < 30) s += 9; else if (p.delivered_pct < 60) s += 4;
    return s;
  };
  const atRiskItems = [...activeProjRows]
    .map((p) => ({ p, score: riskScore(p) })).filter((x) => x.score >= 45)
    .sort((a, b) => b.score - a.score).slice(0, 6);
  const atRisk: PmListData = {
    title: '// at_risk_delivery', ai: 'heavy', empty: 'لا مشاريع تحتاج انتباه ✓',
    footer: atRiskItems.length ? `${atRiskItems.length} يحتاجوا تدخّلك` : undefined,
    items: atRiskItems.map(({ p, score }): PmRow => {
      const dd = p.days_until_due ?? 99;
      const why = p.ai_next_action ?? (dd < 0 ? `متأخّر ${Math.abs(dd)}ي` : `تسليم خلال ${dd}ي · إنجاز ${p.delivered_pct}٪`);
      return { primary: p.name, secondary: why, metric: dd < 0 ? `${Math.abs(dd)}ي-` : `${dd}ي`, tone: score >= 80 ? 'red' : 'amber', href: `/projects/${p.id}` };
    }),
  };

  // ── handoff status (approved, not yet handed to production) ─────────────────
  const handoffItems = activeProjRows.filter((p) => p.stage === 'approved');
  const handoff: PmListData = {
    title: '// handoff_status', ai: 'none', empty: 'لا مشاريع تنتظر التسليم للإنتاج',
    footer: handoffItems.length ? `${handoffItems.length} معتمد بانتظار التسليم` : undefined,
    items: handoffItems.slice(0, 6).map((p): PmRow => {
      const age = ageDays(p.approved_at);
      const ready = !!p.pm_id && !!p.shoot_starts_at;
      return { primary: p.name, secondary: ready ? 'جاهز للتسليم' : 'ناقص: مدير إنتاج / موعد تصوير', metric: `${age}ي`, tone: !ready && age > 2 ? 'red' : ready ? 'green' : 'amber', href: `/projects/${p.id}` };
    }),
  };

  // ── on-time scorecard ──────────────────────────────────────────────────────
  const otPct = onTimeRow.total ? Math.round((onTimeRow.on_time / onTimeRow.total) * 100) : 0;
  const late = onTimeRow.total - onTimeRow.on_time;
  const onTime: PmStatsData = {
    title: '// on_time_delivery', ai: 'none', footer: 'آخر ٩٠ يوم · الهدف ٨٨٪',
    stats: [
      { label: 'تسليم في الموعد', value: onTimeRow.total ? `${otPct}٪` : '—', tone: !onTimeRow.total ? 'dim' : otPct >= 88 ? 'green' : otPct >= 75 ? 'amber' : 'red' },
      { label: 'سُلّمت', value: String(onTimeRow.total), tone: 'dim' },
      { label: 'متأخّرة', value: String(late), tone: late > 0 ? 'red' : 'green' },
    ],
  };

  // ── weekly report status ───────────────────────────────────────────────────
  const wStatus = weeklyRow?.status ?? null;
  const wLabel = wStatus === 'sent' ? 'أُرسل ✓' : wStatus === 'approved' ? 'معتمد' : wStatus === 'draft' ? 'مسودّة' : 'لم يُنشأ';
  const weekly: PmStatsData = {
    title: '// weekly_report', ai: 'light', footer: 'تقريرك الأسبوعي للمدير العام',
    stats: [
      { label: 'حالة هذا الأسبوع', value: wLabel, tone: wStatus === 'sent' ? 'green' : wStatus ? 'amber' : 'red', href: '/performance' },
    ],
  };

  // ── documentation gap (recent WhatsApp newer than the last email) ──────────
  const docGapItems = docGapRows.filter((r) => {
    const wa = r.last_wa ? new Date(r.last_wa).getTime() : 0;
    const em = r.last_email ? new Date(r.last_email).getTime() : 0;
    return wa > em; // WhatsApp activity not (yet) mirrored in an email
  }).slice(0, 6);
  const docGap: PmListData = {
    title: '// email_undocumented', ai: 'light', empty: 'كل التواصل موثّق بالبريد ✓',
    footer: docGapItems.length ? `${docGapItems.length} يحتاجوا توثيق بالبريد` : undefined,
    items: docGapItems.map((r): PmRow => ({
      primary: r.name,
      secondary: r.last_email ? `آخر بريد قبل ${ageDays(r.last_email)}ي · واتساب أحدث` : 'واتساب بدون بريد موثّق',
      metric: 'وثّق', tone: 'amber', href: `/projects/${r.id}`,
    })),
  };

  return { pipeline, deals, response, approvals, atRisk, handoff, onTime, weekly, docGap };
}
