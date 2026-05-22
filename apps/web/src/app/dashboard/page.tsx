import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  Card,
  StatusPill,
  Counter,
  EmptyState,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import Link from 'next/link';
import {
  Briefcase,
  Users,
  Camera,
  ListChecks,
  ArrowUpRight,
  Calendar,
  Package2,
  AlertTriangle,
  TrendingUp,
  Mail,
  Brain,
  Reply,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/view-as';
import { stageTone, stageLabelAr } from '@/lib/project-stage';
import { BriefingCard } from './briefing-card';
import { loadCachedBriefing } from './briefing-actions';
import { CustomizeButton, CARD_CATALOG, type CardId } from './dashboard-customize';

export const dynamic = 'force-dynamic';

const WEEKDAYS_AR = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard');

  // Honor View-As impersonation — the greeting / topbar / any per-user
  // data should match the profile the admin is viewing as.
  const current = await getCurrentProfile();

  // First-login flow (Pillar 16 §H.4). Only redirect the REAL user (not
  // when an admin is viewing-as someone else, otherwise they get bounced
  // every time they pick a fake profile that hasn't onboarded).
  if (current && !current.isImpersonating) {
    const [self] = await db.execute<{ status: string }>(
      sql`SELECT onboarding_state->>'status' AS status FROM profiles WHERE id = ${current.id}::uuid`,
    );
    const status = (self as unknown as { status: string }[])[0]?.status;
    if (status === 'pending' || status === 'in_progress') {
      redirect('/welcome');
    }
  }
  const greetingName =
    current?.displayName?.trim().split(/\s+/)[0] ??
    user.email?.split('@')[0] ??
    'صديقي';

  // ── ALL THE DATA ──────────────────────────────────────────────────────────
  // Each query wrapped in try/catch — one broken query shouldn't 500 the page.
  const safe = async <T,>(
    label: string,
    fn: () => Promise<T>,
    fallback: T,
  ): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      console.error(`[dashboard:${label}]`, err);
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
    initialBriefing,
    commHealthRow,
    pendingSuggestionsArr,
    recentThreadsArr,
    staleFollowupsArr,
  ] = await Promise.all([
    safe('stats', () => db.execute<{
      active_projects: number;
      open_tasks: number;
      open_leads: number;
      equipment_count: number;
      mtd_revenue: string | null;
      overdue_count: number;
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
      id: string;
      code: string;
      title_ar: string | null;
      title: string;
      stage: string;
      starts_at: Date;
      client_name: string | null;
      city: string | null;
    }>(sql`
      SELECT p.id::text, p.code, p.title_ar, p.title, p.stage::text AS stage,
             p.shoot_starts_at AS starts_at,
             c.name_ar AS client_name,
             c.city AS city
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
      id: string;
      project_id: string;
      project_code: string;
      item_number: string | null;
      title: string | null;
      status: string;
      group_name: string;
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

    // Capacity heatmap
    safe('teamLoad', () => db.execute<{
      profile_id: string;
      name: string;
      day_offset: number;
      load: number;
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

    // Budget burn
    safe('budgetBurn', () => db.execute<{
      id: string;
      code: string;
      title_ar: string | null;
      title: string;
      stage: string;
      days_until_due: number;
      contracted_value: string | null;
      open_tasks: number;
      delivered_pct: number;
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

    // Equipment double-booking
    safe('conflicts', () => db.execute<{
      equipment_id: string;
      code: string;
      model: string;
      overlap_starts_at: Date;
      conflicting: number;
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

    safe('briefing', () => loadCachedBriefing(), null),

    // Email inbox↔outbox health (uses v_email_communication_metrics)
    safe('commHealth', () => db.execute<{
      awaiting_our_reply: number;
      awaiting_their_reply: number;
      active_threads: number;
    }>(sql`
      SELECT
        count(*) FILTER (WHERE reply_state = 'awaiting_our_reply')::int  AS awaiting_our_reply,
        count(*) FILTER (WHERE reply_state = 'awaiting_their_reply')::int AS awaiting_their_reply,
        count(*)::int AS active_threads
      FROM v_email_communication_metrics
      WHERE last_message_at > now() - interval '30 days'
    `), [] as Array<{ awaiting_our_reply: number; awaiting_their_reply: number; active_threads: number }>),

    // Pending AI suggestions queue (top 5 by confidence)
    safe('pendingSuggestions', () => db.execute<{
      id: string;
      suggestion_type: string;
      summary_ar: string | null;
      confidence: number;
      thread_subject: string | null;
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

    // Recent active threads with their AI summary
    safe('recentThreads', () => db.execute<{
      id: string;
      subject: string | null;
      ai_summary: string | null;
      last_from: string | null;
      last_message_at: Date;
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

    // Stale follow-ups — threads we sent to but client hasn't replied in >5d
    safe('staleFollowups', () => db.execute<{
      thread_id: string;
      subject: string | null;
      hours: number;
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
    active_projects: number;
    open_tasks: number;
    open_leads: number;
    equipment_count: number;
    mtd_revenue: string | null;
    overdue_count: number;
    pending_review_count: number;
  }>)[0]) ?? {
    active_projects: 0,
    open_tasks: 0,
    open_leads: 0,
    equipment_count: 0,
    mtd_revenue: null,
    overdue_count: 0,
    pending_review_count: 0,
  };

  const shoots = shootsArr as unknown as Array<{
    id: string;
    code: string;
    title_ar: string | null;
    title: string;
    stage: string;
    starts_at: Date;
    client_name: string | null;
    city: string | null;
  }>;

  const deliverablesQueue = deliverablesQueueArr as unknown as Array<{
    id: string;
    project_id: string;
    project_code: string;
    item_number: string | null;
    title: string | null;
    status: string;
    group_name: string;
  }>;

  const teamLoad = teamLoadArr as unknown as Array<{
    profile_id: string;
    name: string;
    day_offset: number;
    load: number;
  }>;

  const budgetBurn = budgetBurnArr as unknown as Array<{
    id: string;
    code: string;
    title_ar: string | null;
    title: string;
    stage: string;
    days_until_due: number;
    contracted_value: string | null;
    open_tasks: number;
    delivered_pct: number;
  }>;

  const conflicts = conflictsArr as unknown as Array<{
    equipment_id: string;
    code: string;
    model: string;
    overlap_starts_at: Date;
    conflicting: number;
  }>;

  const commHealth = ((commHealthRow as unknown as Array<{
    awaiting_our_reply: number;
    awaiting_their_reply: number;
    active_threads: number;
  }>)[0]) ?? { awaiting_our_reply: 0, awaiting_their_reply: 0, active_threads: 0 };

  const pendingSuggestions = pendingSuggestionsArr as unknown as Array<{
    id: string;
    suggestion_type: string;
    summary_ar: string | null;
    confidence: number;
    thread_subject: string | null;
  }>;

  const recentThreads = recentThreadsArr as unknown as Array<{
    id: string;
    subject: string | null;
    ai_summary: string | null;
    last_from: string | null;
    last_message_at: Date;
  }>;

  const staleFollowups = staleFollowupsArr as unknown as Array<{
    thread_id: string;
    subject: string | null;
    hours: number;
  }>;

  // Dashboard customization — read which cards are hidden from cookie.
  const jar = await cookies();
  const hidden = (jar.get('dash_hidden')?.value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const visible = (id: CardId) => !hidden.includes(id);

  // Pivot team load
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
  const people = Array.from(peopleMap.values()).filter(
    (p) => p.days.some((d) => d > 0),
  );

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'صباح الخير' : hour < 18 ? 'مرحباً' : 'مساء الخير';
  const dateStr = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const mtdRevenue = stats?.mtd_revenue ? Number(stats.mtd_revenue) : 0;

  return (
    <Shell
      user={{
        email: current?.email ?? user.email ?? '',
        displayName: current?.displayName ?? user.email?.split('@')[0],
      }}
      activePath="/dashboard"
    >
      {/* AI Daily Briefing — Mix Layered hero */}
      <BriefingCard
        initial={initialBriefing}
        greeting={greeting}
        dateStr={dateStr}
        firstName={greetingName}
      />

      <style>{`
        .dash-cards { display: grid; gap: 14px; grid-template-columns: repeat(12, 1fr); }
        .dash-cards > [data-span="4"] { grid-column: span 4; }
        .dash-cards > [data-span="6"] { grid-column: span 6; }
        .dash-cards > [data-span="3"] { grid-column: span 3; }
        .dash-cards > [data-span="12"] { grid-column: span 12; }
        @media (max-width: 1100px) {
          .dash-cards { grid-template-columns: repeat(6, 1fr); }
          .dash-cards > [data-span="6"] { grid-column: span 6; }
          .dash-cards > [data-span="4"] { grid-column: span 3; }
          .dash-cards > [data-span="3"] { grid-column: span 3; }
        }
        @media (max-width: 720px) {
          .dash-cards { grid-template-columns: 1fr; }
          .dash-cards > * { grid-column: span 1 !important; }
          .today-strip { grid-template-columns: 1fr !important; }
        }
        .today-strip { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
      `}</style>

      {/* اليوم — Today time-strip */}
      <section>
        <header className="mb-3 flex items-baseline gap-3">
          <h2 className="text-[18px] font-bold tracking-[-0.018em]" style={{ fontFamily: 'var(--font-display)' }}>
            اليوم وهذا الأسبوع
          </h2>
          <span className="text-[10px] text-[var(--text-dim)]">
            {shoots.length} shoot · {budgetBurn.length} تسليم قريب
          </span>
          <Link
            href="/calendar"
            className="ms-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline"
          >
            التقويم الكامل <ArrowUpRight size={11} className="rtl:rotate-180" />
          </Link>
        </header>

        {shoots.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Camera size={18} />}
              title="لا تصوير مجدول الأسبوع ده"
              description="ضيف موعد shoot لأي مشروع نشط."
            />
          </Card>
        ) : (
          <div className="today-strip">
            {shoots.map((s) => {
              const dateObj = new Date(s.starts_at);
              const time = dateObj.toISOString().slice(11, 16);
              const daysFromNow = Math.floor(
                (dateObj.getTime() - Date.now()) / 86_400_000,
              );
              const isToday = daysFromNow === 0;
              return (
                <Link
                  key={s.id}
                  href={`/projects/${s.id}`}
                  className={
                    'magnet block rounded-[10px] border p-3 ' +
                    (isToday
                      ? 'border-[var(--accent)]/40 bg-[var(--accent)]/[0.04]'
                      : 'border-[var(--line)] bg-[var(--surface)]')
                  }
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: 'rgba(251,191,36,0.20)', color: '#FBBF24' }}
                    >◰</span>
                    <span
                      className={
                        'font-mono text-[13px] font-semibold ' +
                        (isToday ? 'text-[var(--accent)]' : 'text-[var(--text)]')
                      }
                    >
                      {time}
                    </span>
                    <span className="ms-auto text-[9px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                      {daysFromNow === 0 ? 'اليوم'
                        : daysFromNow === 1 ? 'غداً'
                          : `+${daysFromNow}ي`}
                    </span>
                  </div>
                  <p className="truncate text-[12px] font-medium text-[var(--text)]">
                    {s.title_ar ?? s.title}
                  </p>
                  <p className="truncate text-[10px] text-[var(--text-muted)]">
                    {s.client_name ?? '—'}
                    {s.city && <> · {s.city}</>}
                  </p>
                  <div className="mt-2 border-t border-[var(--line)] pt-2">
                    <p className="font-mono text-[10px] text-[var(--text-dim)]">{s.code}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* اللوحة — Customizable Cards Grid */}
      <section>
        <header className="mb-3 flex items-baseline gap-3">
          <h2 className="text-[18px] font-bold tracking-[-0.018em]" style={{ fontFamily: 'var(--font-display)' }}>
            اللوحة
          </h2>
          <span className="text-[10px] text-[var(--text-dim)]">
            {CARD_CATALOG.length - hidden.length}/{CARD_CATALOG.length} كرت · قابلة للتخصيص
          </span>
          <CustomizeButton hidden={hidden} />
        </header>

        <div className="dash-cards stagger-in">
          {/* في خطر / متأخر */}
          {visible('projects-at-risk') && (
          <DashCard span={4} title="مشاريع في خطر" badge={String(stats.overdue_count + budgetBurn.filter(p => p.days_until_due < 3).length)} tone="danger">
            {stats.overdue_count === 0 && budgetBurn.length === 0 ? (
              <p className="py-2 text-[11px] text-[var(--text-muted)]">لا مشاريع حرجة الآن.</p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {budgetBurn.slice(0, 4).map((p) => {
                  const overdue = p.days_until_due < 0;
                  return (
                    <li key={p.id} className="flex items-center gap-2 py-1.5 text-[11px]">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: overdue ? '#F87171' : p.days_until_due < 3 ? '#FBBF24' : 'var(--text-dim)' }}
                      />
                      <Link href={`/projects/${p.id}`} className="font-mono text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]">
                        {p.code}
                      </Link>
                      <span className="flex-1 truncate text-[var(--text)]">
                        {overdue ? `متأخر ${Math.abs(p.days_until_due)}ي` : `${p.days_until_due}ي`}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">{p.delivered_pct}%</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashCard>
          )}

          {/* الموافقات */}
          {visible('approval-queue') && (
          <DashCard span={4} title="قائمة الموافقات" badge={String(deliverablesQueue.length)}>
            {deliverablesQueue.length === 0 ? (
              <p className="py-2 text-[11px] text-[var(--text-muted)]">المسار فارغ ✓</p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {deliverablesQueue.slice(0, 4).map((d) => (
                  <li key={d.id} className="flex items-center gap-2 py-1.5 text-[11px]">
                    <span className="font-mono text-[10px] text-[var(--text-dim)]">{d.item_number ?? '#'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[var(--text)]">{d.title ?? '(بدون عنوان)'}</p>
                      <p className="truncate text-[10px] text-[var(--text-dim)]">
                        <span className="font-mono">{d.project_code}</span>
                      </p>
                    </div>
                    <Link
                      href={`/projects/${d.project_id}`}
                      className="rounded bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/30"
                    >
                      راجع
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashCard>
          )}

          {/* تعارضات معدات */}
          {visible('equipment-conflicts') && (
          <DashCard span={4} title="تعارضات معدات" badge={String(conflicts.length)} tone={conflicts.length > 0 ? 'warning' : undefined}>
            {conflicts.length === 0 ? (
              <p className="py-2 text-[11px] text-[var(--text-muted)]">لا يوجد تعارضات.</p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {conflicts.slice(0, 4).map((c) => (
                  <li key={c.equipment_id} className="py-1.5 text-[11px]">
                    <p className="font-medium text-[var(--text)]">
                      {c.code} <span className="text-[10px] text-[var(--text-dim)]">· {c.model}</span>
                    </p>
                    <p className="text-[10px] text-[var(--warning)]">
                      {c.conflicting} حجز متداخل من {new Date(c.overlap_starts_at).toISOString().slice(0, 10)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </DashCard>
          )}

          {/* حمولة الفريق — top 5 */}
          {visible('team-load') && (
          <DashCard span={6} title="حمولة الفريق · ١٤ يوم" link={{ href: '/team', label: 'الفريق' }}>
            {people.length === 0 ? (
              <p className="py-2 text-[11px] text-[var(--text-muted)]">لا توظيفات نشطة.</p>
            ) : (
              <ul className="space-y-1.5">
                {[...people]
                  .sort((a, b) => b.days.reduce((s, d) => s + d, 0) - a.days.reduce((s, d) => s + d, 0))
                  .slice(0, 5)
                  .map((p) => {
                    const total = p.days.reduce((s, d) => s + d, 0);
                    const pct = Math.min(100, (total / 28) * 100);
                    const over = total > 28;
                    return (
                      <li key={p.profileId} className="grid grid-cols-[100px,1fr,30px] items-center gap-2 text-[11px]">
                        <span className="truncate text-[var(--text)]">{p.name}</span>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.min(100, pct)}%`,
                              background: over ? '#F87171' : pct > 75 ? '#FBBF24' : 'var(--accent)',
                            }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">{total}</span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </DashCard>
          )}

          {/* Revenue forecast */}
          {visible('mtd-revenue') && (
          <DashCard span={6} title="إيراد الشهر" badge={mtdRevenue > 0 ? 'MTD' : undefined} tone="success">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p
                  className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[var(--accent)]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  <Counter to={mtdRevenue} format="k" />
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-dim)]">SAR محصّل من بداية الشهر</p>
              </div>
              <div className="text-end">
                <p className="text-[10px] text-[var(--text-dim)]">منذ التحديث</p>
                <p className="font-mono text-[11px] text-[var(--text-muted)]">live · pg_cron</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-12 gap-[2px]" style={{ height: 36 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-sm"
                  style={{
                    background: i > 7 ? 'var(--accent)' : 'var(--text-dim)',
                    opacity: i > 7 ? 0.9 : 0.25,
                    height: `${30 + ((i * 17) % 60)}%`,
                    alignSelf: 'end',
                  }}
                />
              ))}
            </div>
          </DashCard>
          )}

          {/* ── Email Intelligence cards ─────────────────────────────── */}

          {/* Email inbox health */}
          {visible('email-health') && (
          <DashCard
            span={4}
            title="صحة الوارد"
            badge={String(commHealth.active_threads)}
            tone={commHealth.awaiting_our_reply > 0 ? 'warning' : undefined}
            link={{ href: '/inbox', label: 'الوارد' }}
          >
            <div className="grid grid-cols-3 gap-2 py-1">
              <div>
                <p className="font-mono text-[20px] font-bold leading-none text-[var(--warning)]">
                  {commHealth.awaiting_our_reply}
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-dim)]">
                  ينتظر ردنا
                </p>
              </div>
              <div>
                <p className="font-mono text-[20px] font-bold leading-none text-[var(--text)]">
                  {commHealth.awaiting_their_reply}
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-dim)]">
                  ننتظر ردهم
                </p>
              </div>
              <div>
                <p className="font-mono text-[20px] font-bold leading-none text-[var(--accent)]">
                  {commHealth.active_threads}
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-dim)]">
                  محادثات نشطة
                </p>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-dim)]">
              آخر ٣٠ يوم · مصدر: v_email_communication_metrics
            </p>
          </DashCard>
          )}

          {/* AI suggestions queue */}
          {visible('email-suggestions') && (
          <DashCard
            span={4}
            title="اقتراحات AI من الإيميل"
            badge={String(pendingSuggestions.length)}
            link={{ href: '/inbox/suggestions', label: 'المراجعة' }}
          >
            {pendingSuggestions.length === 0 ? (
              <p className="py-2 text-[11px] text-[var(--text-muted)]">
                مفيش اقتراحات معلقة. لما تيجي إيميلات جديدة، الـ AI هيقترح إجراءات.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {pendingSuggestions.slice(0, 4).map((s) => (
                  <li key={s.id} className="py-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Brain size={10} className="text-[var(--accent)]" />
                      <span className="font-mono text-[9px] uppercase text-[var(--text-dim)]">
                        {s.suggestion_type.replace(/_/g, ' ')}
                      </span>
                      <span className="ms-auto font-mono text-[9px] text-[var(--text-muted)]">
                        {(s.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[var(--text)]">
                      {s.summary_ar ?? s.thread_subject ?? '—'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </DashCard>
          )}

          {/* Recent threads with AI summary */}
          {visible('email-recent') && (
          <DashCard
            span={4}
            title="آخر إيميلات"
            badge={String(recentThreads.length)}
            link={{ href: '/inbox', label: 'الوارد' }}
          >
            {recentThreads.length === 0 ? (
              <p className="py-2 text-[11px] text-[var(--text-muted)]">
                لا إيميلات نشطة في آخر أسبوعين.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {recentThreads.slice(0, 4).map((t) => {
                  const daysAgo = Math.floor(
                    (Date.now() - new Date(t.last_message_at).getTime()) /
                      86_400_000,
                  );
                  return (
                    <li key={t.id} className="py-1.5 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Mail size={10} className="text-[var(--text-dim)]" />
                        <span className="truncate font-medium text-[var(--text)]">
                          {t.subject ?? '(بدون عنوان)'}
                        </span>
                        <span className="ms-auto shrink-0 font-mono text-[9px] text-[var(--text-dim)]">
                          {daysAgo === 0 ? 'اليوم' : `${daysAgo}ي`}
                        </span>
                      </div>
                      {t.ai_summary && (
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--text-muted)]">
                          {t.ai_summary}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </DashCard>
          )}

          {/* Stale follow-ups */}
          {visible('email-followups') && (
          <DashCard
            span={4}
            title="متابعات مستحقة"
            badge={String(staleFollowups.length)}
            tone={staleFollowups.length > 0 ? 'warning' : undefined}
            link={{ href: '/inbox/suggestions', label: 'الاقتراحات' }}
          >
            {staleFollowups.length === 0 ? (
              <p className="py-2 text-[11px] text-[var(--text-muted)]">
                مفيش محادثات معلقة أكتر من ٥ أيام ✓
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {staleFollowups.slice(0, 4).map((s) => {
                  const days = Math.floor(s.hours / 24);
                  return (
                    <li key={s.thread_id} className="flex items-center gap-2 py-1.5 text-[11px]">
                      <Reply size={11} className="shrink-0 text-[var(--warning)]" />
                      <span className="min-w-0 flex-1 truncate text-[var(--text)]">
                        {s.subject ?? '(بدون عنوان)'}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--warning)]">
                        {days}ي
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashCard>
          )}

          {/* Mini stats */}
          {visible('mini-active') && (
            <MiniStat span={3} label="مشاريع نشطة" value={stats?.active_projects ?? 0} href="/projects" />
          )}
          {visible('mini-tasks') && (
            <MiniStat span={3} label="مهام مفتوحة" value={stats?.open_tasks ?? 0} href="/tasks" />
          )}
          {visible('mini-leads') && (
            <MiniStat span={3} label="Leads" value={stats?.open_leads ?? 0} href="/crm" />
          )}
          {visible('mini-review') && (
            <MiniStat
              span={3}
              label="بانتظار مراجعة"
              value={stats?.pending_review_count ?? 0}
              tone={stats.pending_review_count > 0 ? 'warning' : 'default'}
            />
          )}

          {hidden.length === CARD_CATALOG.length && (
            <div
              data-span="12"
              className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-[12px] text-[var(--text-muted)]"
            >
              كل الكروت مخفية. اضغط <span className="text-[var(--accent)]">تخصيص</span> لاختيار اللي تظهر.
            </div>
          )}
        </div>
      </section>

      {/* Capacity heatmap — expandable */}
      <details className="group rounded-xl border border-[var(--line)] bg-[var(--surface)]/40">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            توظيف الفريق · ١٤ يوم
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            ({people.length} عضو)
          </span>
          <span className="ms-auto text-[11px] text-[var(--accent)] group-open:hidden">
            افتح الجدول ↓
          </span>
          <span className="ms-auto hidden text-[11px] text-[var(--accent)] group-open:inline">
            اطوي ↑
          </span>
        </summary>
        <div className="border-t border-[var(--line)] p-4">
        {people.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users size={18} />}
              title="لا توظيفات نشطة"
              description="عيّن أعضاء على مشاريع لتظهر الـ heatmap."
            />
          </Card>
        ) : (
          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/60">
                    <th className="px-4 py-2 text-start text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                      الفريق
                    </th>
                    {Array.from({ length: 14 }, (_, i) => {
                      const d = new Date(Date.now() + i * 86_400_000);
                      const day = d.getUTCDate();
                      const dow = d.getUTCDay();
                      const isWeekend = dow === 5 || dow === 6;
                      const isToday = i === 0;
                      return (
                        <th
                          key={i}
                          className={
                            'px-1 py-2 text-center text-[10px] font-mono ' +
                            (isToday
                              ? 'text-[var(--accent)] font-bold'
                              : isWeekend
                                ? 'text-[var(--text-dim)]'
                                : 'text-[var(--text-muted)]')
                          }
                        >
                          {day}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {people.map((p) => {
                    const max = Math.max(...p.days, 1);
                    return (
                      <tr key={p.profileId}>
                        <td className="whitespace-nowrap px-4 py-2 text-[12px] text-[var(--text)]">
                          {p.name}
                        </td>
                        {p.days.map((load, i) => {
                          const intensity = load / max;
                          const color =
                            load === 0
                              ? 'bg-transparent'
                              : load >= 4
                                ? 'bg-[var(--danger)]/70'
                                : load >= 3
                                  ? 'bg-[var(--warning)]/60'
                                  : 'bg-[var(--success)]/40';
                          return (
                            <td key={i} className="p-1">
                              <div
                                className={`h-7 rounded-sm ${color} relative`}
                                title={`${load} مشروع`}
                                style={{
                                  opacity: load === 0 ? 0.15 : 0.6 + intensity * 0.4,
                                }}
                              >
                                {load > 0 && (
                                  <span className="absolute inset-0 grid place-items-center font-mono text-[10px] font-bold text-[var(--text)]">
                                    {load}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3 text-[10px] text-[var(--text-dim)]">
              <span>كثافة:</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-sm bg-[var(--success)]/40" />
                خفيف
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-sm bg-[var(--warning)]/60" />
                متوسط
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-sm bg-[var(--danger)]/70" />
                حمل زائد
              </span>
            </div>
          </Card>
        )}
        </div>
      </details>

      {/* Ask Claude footer */}
      <section className="flex items-center gap-3 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-3">
        <span
          className="grid h-8 w-8 place-items-center rounded-md font-bold text-white"
          style={{ background: 'var(--accent-gradient)', fontSize: 12 }}
        >C</span>
        <input
          type="text"
          placeholder="اسأل Claude أي حاجة عن Volt… (قريباً)"
          disabled
          className="flex-1 bg-transparent text-[13px] text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none"
        />
        <button
          type="button"
          disabled
          className="inline-flex h-8 items-center rounded-md px-3 text-[11px] font-semibold text-white opacity-50"
          style={{ background: 'var(--accent-gradient)' }}
        >
          ↗ اسأل
        </button>
      </section>

      <div className="hidden">
        {/* — legacy approval/budget sections retained below for fallback view if Mohammed wants them back — */}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 hidden">
        {/* Approval queue */}
        <section className="space-y-3">
          <header className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
                — قائمة الموافقات
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">
                مخرجات بانتظار مراجعة
              </h2>
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">
              {deliverablesQueue.length} عنصر
            </span>
          </header>

          {deliverablesQueue.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ListChecks size={18} />}
                title="لا توجد مخرجات بانتظار المراجعة"
                description="ممتاز — المسار فارغ."
              />
            </Card>
          ) : (
            <Card padded={false}>
              <ul className="divide-y divide-[var(--line)]">
                {deliverablesQueue.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/projects/${d.project_id}`}
                      className="grid grid-cols-[auto,1fr,auto] items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)]"
                    >
                      <span className="font-mono text-[10px] text-[var(--text-dim)]">
                        {d.item_number ?? '#'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] text-[var(--text)]">
                          {d.title ?? '(بدون عنوان)'}
                        </p>
                        <p className="truncate text-[10px] text-[var(--text-muted)]">
                          <span className="font-mono">{d.project_code}</span>
                          {' '}· {d.group_name}
                        </p>
                      </div>
                      <StatusPill
                        tone={
                          d.status === 'pending_director'
                            ? 'warning'
                            : d.status === 'pending_am'
                              ? 'warning'
                              : d.status === 'in_client_review'
                                ? 'info'
                                : 'accent'
                        }
                      >
                        {d.status.replace(/_/g, ' ')}
                      </StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* Budget burn forecast */}
        <section className="space-y-3">
          <header className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
                — مشاريع تقترب من التسليم
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">
                خلال أسبوعين
              </h2>
            </div>
          </header>

          {budgetBurn.length === 0 ? (
            <Card>
              <EmptyState
                icon={<TrendingUp size={18} />}
                title="لا تسليمات قريبة"
                description="لا يوجد deadlines في الـ14 يوم القادمة."
              />
            </Card>
          ) : (
            <Card padded={false}>
              <ul className="divide-y divide-[var(--line)]">
                {budgetBurn.map((p) => {
                  const overdue = p.days_until_due < 0;
                  const close = p.days_until_due >= 0 && p.days_until_due < 3;
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/projects/${p.id}`}
                        className="grid grid-cols-[auto,1fr,auto] items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)]"
                      >
                        <div className="text-center">
                          <p
                            className={
                              'font-mono text-[18px] font-bold leading-none ' +
                              (overdue
                                ? 'text-[var(--danger)]'
                                : close
                                  ? 'text-[var(--warning)]'
                                  : 'text-[var(--text)]')
                            }
                          >
                            {overdue
                              ? `+${Math.abs(p.days_until_due)}`
                              : p.days_until_due}
                          </p>
                          <p className="text-[9px] text-[var(--text-dim)]">
                            {overdue ? 'متأخر' : 'يوم'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-[var(--text)]">
                            <span className="font-mono text-[10px] text-[var(--text-dim)]">
                              {p.code}
                            </span>{' '}
                            {p.title_ar ?? p.title}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface)]">
                              <div
                                className={
                                  'h-full transition-all ' +
                                  (p.delivered_pct >= 80
                                    ? 'bg-[var(--success)]'
                                    : p.delivered_pct >= 40
                                      ? 'bg-[var(--accent)]'
                                      : 'bg-[var(--danger)]')
                                }
                                style={{ width: `${p.delivered_pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-[var(--text-muted)]">
                              {p.delivered_pct}%
                            </span>
                          </div>
                        </div>
                        <StatusPill tone={stageTone(p.stage)}>
                          {stageLabelAr(p.stage)}
                        </StatusPill>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-4 text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
        <span>— Antagna Dashboard</span>
        <span>{new Date().getFullYear()} · Volt Production</span>
      </div>
    </Shell>
  );
}

function DashCard({
  span,
  title,
  badge,
  tone,
  link,
  children,
}: {
  span: number;
  title: string;
  badge?: string;
  tone?: 'success' | 'warning' | 'danger';
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const badgeColor =
    tone === 'success' ? 'var(--success)'
      : tone === 'warning' ? 'var(--warning)'
        : tone === 'danger' ? 'var(--danger)'
          : 'var(--text-muted)';
  return (
    <div
      data-span={span}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <h3 className="text-[12px] font-semibold text-[var(--text)]">{title}</h3>
        {badge != null && (
          <span
            className="rounded px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: badgeColor + '22', color: badgeColor }}
          >
            {badge}
          </span>
        )}
        {link && (
          <Link href={link.href} className="ms-auto text-[10px] text-[var(--accent)] hover:underline">
            {link.label} →
          </Link>
        )}
        <span className="cursor-grab text-[var(--text-dim)]" style={link ? {} : { marginInlineStart: 'auto' }} title="drag to rearrange">
          ⋮⋮
        </span>
      </div>
      {children}
    </div>
  );
}

function MiniStat({
  span,
  label,
  value,
  href,
  tone = 'default',
}: {
  span: number;
  label: string;
  value: number;
  href?: string;
  tone?: 'default' | 'warning' | 'danger' | 'accent';
}) {
  const color =
    tone === 'accent' ? 'var(--accent)'
      : tone === 'warning' ? 'var(--warning)'
        : tone === 'danger' ? 'var(--danger)'
          : 'var(--text)';
  const inner = (
    <>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p
        className="mt-1 text-[24px] font-bold leading-none tracking-[-0.018em] tabular"
        style={{ color, fontFamily: 'var(--font-display)' }}
      >
        <Counter to={value} />
      </p>
    </>
  );
  const cls = 'rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 block ' +
    (href ? 'magnet hover:border-[var(--line-strong)]' : '');
  if (href) {
    return (
      <Link href={href} data-span={span} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <div data-span={span} className={cls}>
      {inner}
    </div>
  );
}

function Kpi({
  label,
  value,
  format,
  icon,
  href,
  tone = 'default',
}: {
  label: string;
  value: number;
  format?: 'plain' | 'k' | 'sar' | 'pct';
  icon?: React.ReactNode;
  href?: string;
  tone?: 'default' | 'accent' | 'warning';
}) {
  const numColor =
    tone === 'accent'
      ? 'text-[var(--accent)]'
      : tone === 'warning'
        ? 'text-[var(--warning)]'
        : 'text-[var(--text)]';
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
          {label}
        </span>
        {icon && <span className="text-[var(--text-dim)]">{icon}</span>}
      </div>
      <div className="mt-3">
        <span className={`text-[28px] font-bold leading-none tracking-tight tabular ${numColor}`}>
          <Counter to={value} format={format} />
        </span>
      </div>
    </>
  );
  const cls =
    'group block rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-4 ' +
    (href ? 'magnet hover:border-[var(--line-strong)]' : '');
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function AlertCard({
  tone,
  icon,
  label,
  value,
  href,
}: {
  tone: 'danger' | 'warning';
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
}) {
  const border = tone === 'danger' ? 'border-[var(--danger)]/40' : 'border-[var(--warning)]/40';
  const bg = tone === 'danger' ? 'bg-[var(--danger)]/[0.05]' : 'bg-[var(--warning)]/[0.05]';
  const text = tone === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--warning)]';
  return (
    <a
      href={href}
      className={`magnet flex items-center justify-between rounded-lg border ${border} ${bg} p-4`}
    >
      <div className="flex items-center gap-3">
        <span className={text}>{icon}</span>
        <p className={`text-[13px] font-medium ${text}`}>{label}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`font-mono text-[20px] font-bold ${text}`}>{value}</span>
        <ArrowUpRight size={14} className={`${text} rtl:rotate-180`} />
      </div>
    </a>
  );
}
