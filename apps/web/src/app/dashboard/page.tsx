import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  PageHeader,
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
  Plus,
  Calendar,
  Package2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { stageTone, stageLabelAr } from '@/lib/project-stage';
import { BriefingCard } from './briefing-card';
import { loadCachedBriefing } from './briefing-actions';

export const dynamic = 'force-dynamic';

const WEEKDAYS_AR = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard');

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
      user={{ email: user.email ?? '', displayName: user.email?.split('@')[0] }}
      activePath="/dashboard"
    >
      <PageHeader
        eyebrow={`${greeting} · ${dateStr}`}
        title="لوحة التحكم"
        subtitle="نظرة عامة على كل ما يحرّك Volt اليوم — مع تلخيص الذكاء الاصطناعي."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/projects/new"
              className="magnet inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus size={15} />
              مشروع جديد
            </Link>
          </div>
        }
      />

      {/* AI Daily Briefing — the hero */}
      <BriefingCard initial={initialBriefing} />

      {/* Critical alerts row */}
      {(stats.overdue_count > 0 || conflicts.length > 0) && (
        <section className="grid grid-cols-1 gap-3 stagger-in md:grid-cols-2">
          {stats.overdue_count > 0 && (
            <AlertCard
              tone="danger"
              icon={<AlertTriangle size={16} />}
              label="مشاريع متأخرة عن التسليم"
              value={stats.overdue_count}
              href="/projects?stage=editing"
            />
          )}
          {conflicts.length > 0 && (
            <AlertCard
              tone="warning"
              icon={<Package2 size={16} />}
              label="تعارضات في حجوزات المعدات"
              value={conflicts.length}
              href="/equipment"
            />
          )}
        </section>
      )}

      {/* Today + this week shoots */}
      <section className="space-y-4">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
              — تصوير هذا الأسبوع
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">
              {shoots.length === 0 ? 'لا shoots مجدولة' : `${shoots.length} shoot`}
            </h2>
          </div>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] hover:underline"
          >
            التقويم <ArrowUpRight size={11} className="rtl:rotate-180" />
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
          <div className="grid grid-cols-1 gap-3 stagger-in md:grid-cols-2 lg:grid-cols-3">
            {shoots.map((s) => {
              const dateObj = new Date(s.starts_at);
              const dayNum = dateObj.getUTCDate();
              const weekday = WEEKDAYS_AR[dateObj.getUTCDay()];
              const time = dateObj.toISOString().slice(11, 16);
              const daysFromNow = Math.floor(
                (dateObj.getTime() - Date.now()) / 86_400_000,
              );
              return (
                <Link
                  key={s.id}
                  href={`/projects/${s.id}`}
                  className="magnet grid grid-cols-[60px,1fr] gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-4 hover:border-[var(--line-strong)]"
                >
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                      {weekday}
                    </p>
                    <p className="font-mono text-[28px] font-bold leading-none text-[var(--accent)]">
                      {dayNum}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--text-muted)]">
                      {time}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                      {daysFromNow === 0 ? 'اليوم'
                        : daysFromNow === 1 ? 'غداً'
                          : `خلال ${daysFromNow} يوم`}
                    </p>
                    <p className="mt-1 truncate text-[13px] font-semibold text-[var(--text)]">
                      {s.title_ar ?? s.title}
                    </p>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {s.client_name ?? '—'}
                      {s.city && <> · {s.city}</>}
                    </p>
                    <div className="mt-1.5">
                      <StatusPill tone={stageTone(s.stage)}>
                        {stageLabelAr(s.stage)}
                      </StatusPill>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 stagger-in md:grid-cols-5">
        <Kpi
          label="نشطة"
          value={stats?.active_projects ?? 0}
          icon={<Briefcase size={14} />}
          href="/projects"
        />
        <Kpi
          label="إيراد الشهر"
          value={mtdRevenue}
          format="k"
          icon={<TrendingUp size={14} />}
          tone="accent"
        />
        <Kpi
          label="مهام مفتوحة"
          value={stats?.open_tasks ?? 0}
          icon={<ListChecks size={14} />}
          href="/tasks"
        />
        <Kpi
          label="Leads"
          value={stats?.open_leads ?? 0}
          icon={<Users size={14} />}
          href="/crm"
        />
        <Kpi
          label="بانتظار مراجعة"
          value={stats?.pending_review_count ?? 0}
          icon={<Calendar size={14} />}
          tone={stats.pending_review_count > 0 ? 'warning' : 'default'}
        />
      </section>

      {/* Capacity heatmap */}
      <section className="space-y-3">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
              — توظيف الفريق · ١٤ يوم
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">
              من شغّال على إيه و متى؟
            </h2>
          </div>
          <Link
            href="/team"
            className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] hover:underline"
          >
            الفريق <ArrowUpRight size={11} className="rtl:rotate-180" />
          </Link>
        </header>
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
                عبء زائد
              </span>
            </div>
          </Card>
        )}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
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
                description="ممتاز — الـ pipeline فاضي."
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
                description="مفيش deadlines في الـ14 يوم القادمة."
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

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Dashboard</span>
        <span>{new Date().getFullYear()} · Volt Production</span>
      </div>
    </Shell>
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
