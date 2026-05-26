import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, StatusPill, EmptyState, AIHints, type AIHint } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import Link from 'next/link';
import { Calendar, CalendarClock, Truck, Camera } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { stageTone, stageLabelAr } from '@/lib/project-stage';

export const dynamic = 'force-dynamic';

type Day = {
  date: string;
  shoots: Array<{
    type: 'shoot_start' | 'shoot_end';
    project_id: string;
    project_code: string;
    project_title: string;
    title_ar: string | null;
    stage: string;
    pm: string | null;
    client: string | null;
  }>;
  deliveries: Array<{
    project_id: string;
    project_code: string;
    project_title: string;
    title_ar: string | null;
    stage: string;
    pm: string | null;
    client: string | null;
  }>;
  reservations: Array<{
    id: string;
    starts_iso: string;
    ends_iso: string;
    eq_code: string | null;
    eq_model: string | null;
    project_code: string | null;
    project_id: string | null;
  }>;
};

const WEEKDAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = Math.min(45, Math.max(7, Number(sp.days ?? 14) || 14));

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/calendar');

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const startISO = today.toISOString().slice(0, 10);
  const endISO = new Date(today.getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [shootsRes, deliveriesRes, reservationsRes] = await Promise.all([
    db.execute<{
      project_id: string;
      project_code: string;
      project_title: string;
      title_ar: string | null;
      stage: string;
      shoot_starts: Date | null;
      shoot_ends: Date | null;
      pm: string | null;
      client: string | null;
    }>(sql`
      SELECT p.id::text AS project_id, p.code AS project_code,
             p.title AS project_title, p.title_ar,
             p.stage::text AS stage,
             p.shoot_starts_at AS shoot_starts,
             p.shoot_ends_at AS shoot_ends,
             prof.display_name AS pm,
             c.name_ar AS client
      FROM projects p
      LEFT JOIN profiles prof ON prof.id = p.project_manager_id
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.archived_at IS NULL
        AND (
          (p.shoot_starts_at IS NOT NULL
            AND p.shoot_starts_at >= ${startISO}::date
            AND p.shoot_starts_at < ${endISO}::date)
          OR
          (p.shoot_ends_at IS NOT NULL
            AND p.shoot_ends_at >= ${startISO}::date
            AND p.shoot_ends_at < ${endISO}::date)
        )
    `),
    db.execute<{
      project_id: string;
      project_code: string;
      project_title: string;
      title_ar: string | null;
      stage: string;
      delivery_due: Date;
      pm: string | null;
      client: string | null;
    }>(sql`
      SELECT p.id::text AS project_id, p.code AS project_code,
             p.title AS project_title, p.title_ar,
             p.stage::text AS stage,
             p.delivery_due_at AS delivery_due,
             prof.display_name AS pm,
             c.name_ar AS client
      FROM projects p
      LEFT JOIN profiles prof ON prof.id = p.project_manager_id
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.archived_at IS NULL
        AND p.delivery_due_at IS NOT NULL
        AND p.delivery_due_at >= ${startISO}::date
        AND p.delivery_due_at < ${endISO}::date
    `),
    db.execute<{
      id: string;
      starts_at: Date;
      ends_at: Date;
      eq_code: string | null;
      eq_model: string | null;
      project_code: string | null;
      project_id: string | null;
    }>(sql`
      SELECT r.id::text AS id, r.starts_at, r.ends_at,
             e.code AS eq_code, e.model AS eq_model,
             p.code AS project_code, p.id::text AS project_id
      FROM equipment_reservations r
      LEFT JOIN equipment e ON e.id = r.equipment_id
      LEFT JOIN projects p ON p.id = r.project_id
      WHERE r.starts_at < ${endISO}::date
        AND r.ends_at >= ${startISO}::date
        AND r.status != 'cancelled'
      ORDER BY r.starts_at
    `),
  ]);

  // Build per-day buckets
  const dayMap = new Map<string, Day>();
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    dayMap.set(iso, { date: iso, shoots: [], deliveries: [], reservations: [] });
  }

  const shootArr = shootsRes as unknown as Array<{
    project_id: string;
    project_code: string;
    project_title: string;
    title_ar: string | null;
    stage: string;
    shoot_starts: Date | null;
    shoot_ends: Date | null;
    pm: string | null;
    client: string | null;
  }>;
  for (const s of shootArr) {
    if (s.shoot_starts) {
      const iso = new Date(s.shoot_starts).toISOString().slice(0, 10);
      const day = dayMap.get(iso);
      if (day) {
        day.shoots.push({
          type: 'shoot_start',
          project_id: s.project_id,
          project_code: s.project_code,
          project_title: s.project_title,
          title_ar: s.title_ar,
          stage: s.stage,
          pm: s.pm,
          client: s.client,
        });
      }
    }
    if (s.shoot_ends) {
      const iso = new Date(s.shoot_ends).toISOString().slice(0, 10);
      const day = dayMap.get(iso);
      if (day) {
        day.shoots.push({
          type: 'shoot_end',
          project_id: s.project_id,
          project_code: s.project_code,
          project_title: s.project_title,
          title_ar: s.title_ar,
          stage: s.stage,
          pm: s.pm,
          client: s.client,
        });
      }
    }
  }

  const delivArr = deliveriesRes as unknown as Array<{
    project_id: string;
    project_code: string;
    project_title: string;
    title_ar: string | null;
    stage: string;
    delivery_due: Date;
    pm: string | null;
    client: string | null;
  }>;
  for (const d of delivArr) {
    const iso = new Date(d.delivery_due).toISOString().slice(0, 10);
    const day = dayMap.get(iso);
    if (day) {
      day.deliveries.push({
        project_id: d.project_id,
        project_code: d.project_code,
        project_title: d.project_title,
        title_ar: d.title_ar,
        stage: d.stage,
        pm: d.pm,
        client: d.client,
      });
    }
  }

  const resArr = reservationsRes as unknown as Array<{
    id: string;
    starts_at: Date;
    ends_at: Date;
    eq_code: string | null;
    eq_model: string | null;
    project_code: string | null;
    project_id: string | null;
  }>;
  for (const r of resArr) {
    const startIso = new Date(r.starts_at).toISOString().slice(0, 10);
    const day = dayMap.get(startIso);
    if (day) {
      day.reservations.push({
        id: r.id,
        starts_iso: new Date(r.starts_at).toISOString(),
        ends_iso: new Date(r.ends_at).toISOString(),
        eq_code: r.eq_code,
        eq_model: r.eq_model,
        project_code: r.project_code,
        project_id: r.project_id,
      });
    }
  }

  const dayList = Array.from(dayMap.values());
  const totalShoots = dayList.reduce((s, d) => s + d.shoots.length, 0);
  const totalDeliveries = dayList.reduce((s, d) => s + d.deliveries.length, 0);
  const totalReservations = dayList.reduce(
    (s, d) => s + d.reservations.length,
    0,
  );

  const otherRanges = [7, 14, 30];

  // AI hints
  const todayKey = startISO;
  const todayDay = dayMap.get(todayKey);
  const shootsToday = todayDay?.shoots.length ?? 0;
  const deliveriesToday = todayDay?.deliveries.length ?? 0;
  const eqByDay = new Map<string, Map<string, number>>();
  for (const [dateKey, d] of dayMap) {
    const m = new Map<string, number>();
    for (const r of d.reservations) {
      if (!r.eq_code) continue;
      m.set(r.eq_code, (m.get(r.eq_code) ?? 0) + 1);
    }
    eqByDay.set(dateKey, m);
  }
  let conflictDays = 0;
  for (const [, m] of eqByDay) {
    for (const [, n] of m) if (n > 1) { conflictDays++; break; }
  }

  const hints: AIHint[] = [];
  if (shootsToday > 0 || deliveriesToday > 0) {
    hints.push({
      index: '01',
      text: `اليوم: ${shootsToday} shoot${deliveriesToday > 0 ? ` · ${deliveriesToday} تسليم` : ''}`,
      insight: 'تحقق من الجاهزية قبل ساعتين من وقت كل بند.',
      urgent: shootsToday > 0,
      actions: [{ label: 'افتح يوم اليوم', href: `#day-${todayKey}`, primary: true }],
    });
  }
  if (conflictDays > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${conflictDays} يوم فيه تعارض حجز معدّة`,
      insight: 'نفس المعدّة محجوزة لمشروعين في نفس اليوم — قرّر الأولوية.',
      urgent: true,
      actions: [{ label: 'افحص المعدات', href: '/equipment', primary: true }],
    });
  }
  if (totalDeliveries >= 3) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${totalDeliveries} تسليم خلال ${days} يوم`,
      insight: 'كثافة عالية — وزّع الجداول بحيث ما يتراكم اليوم الأخير.',
      actions: [{ label: 'اعرض المشاريع', href: '/projects' }],
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/calendar">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · التقويم"
          headline={`${totalShoots} shoot · ${totalDeliveries} تسليم · ${totalReservations} حجز`}
          hints={hints}
          compact
        />
      )}
      <PageHeader
        eyebrow="Calendar"
        title="التقويم"
        subtitle={`الـ${days} يوم القادمة — تصوير، تسليم، حجوزات معدات.`}
        action={
          <div className="flex items-center gap-1">
            {otherRanges.map((r) => (
              <Link
                key={r}
                href={`/calendar?days=${r}`}
                className={
                  'magnet inline-flex h-9 items-center rounded-md border px-3 text-[12px] ' +
                  (days === r
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--line-strong)]')
                }
              >
                {r} يوم
              </Link>
            ))}
          </div>
        }
      />

      <section className="grid grid-cols-3 gap-4 stagger-in">
        <StatBox
          label="جلسات تصوير"
          value={totalShoots}
          icon={<Camera size={16} />}
        />
        <StatBox
          label="مواعيد تسليم"
          value={totalDeliveries}
          icon={<CalendarClock size={16} />}
          tone={totalDeliveries > 0 ? 'warning' : 'default'}
        />
        <StatBox
          label="حجوزات معدات"
          value={totalReservations}
          icon={<Truck size={16} />}
        />
      </section>

      {totalShoots + totalDeliveries + totalReservations === 0 ? (
        <Card>
          <EmptyState
            icon={<Calendar size={18} />}
            title="لا أحداث في هذه الفترة"
            description="ضيف موعد تصوير أو تسليم على أي مشروع لتشوفه هنا."
          />
        </Card>
      ) : (
        <div className="space-y-2 stagger-in">
          {dayList.map((d) => {
            const dateObj = new Date(d.date);
            const weekday = WEEKDAYS_AR[dateObj.getUTCDay()];
            const dayNum = dateObj.getUTCDate();
            const monthAr = dateObj.toLocaleDateString('ar-SA', {
              month: 'long',
            });
            const isToday = d.date === startISO;
            const isWeekend =
              dateObj.getUTCDay() === 5 || dateObj.getUTCDay() === 6;
            const isEmpty =
              d.shoots.length === 0 &&
              d.deliveries.length === 0 &&
              d.reservations.length === 0;

            return (
              <div
                key={d.date}
                className={
                  'grid grid-cols-[88px_1fr] gap-5 border-b border-[var(--line)] px-2 py-4 ' +
                  (isEmpty ? 'opacity-40' : '') +
                  (isToday ? ' bg-[var(--accent)]/[0.03]' : '')
                }
              >
                <div>
                  <p
                    className={
                      'text-[10px] font-semibold uppercase tracking-[0.22em] ' +
                      (isToday
                        ? 'text-[var(--accent)]'
                        : 'text-[var(--text-dim)]')
                    }
                  >
                    {isToday ? '— اليوم' : weekday}
                  </p>
                  <p className="font-mono text-[36px] font-bold leading-none tracking-tight text-[var(--text)]">
                    {dayNum}
                  </p>
                  <p className="text-[10px] text-[var(--text-dim)]">
                    {monthAr}
                  </p>
                  {isWeekend && !isToday && (
                    <span className="mt-2 inline-block text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                      عطلة
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 py-1">
                  {d.shoots.map((s, i) => (
                    <Link
                      key={`s-${i}`}
                      href={`/projects/${s.project_id}`}
                      className="group flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 px-3 py-2 hover:border-[var(--accent)]"
                    >
                      <Camera size={13} className="text-[var(--accent)]" />
                      <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                        {s.type === 'shoot_start' ? 'بداية تصوير' : 'نهاية تصوير'}
                      </span>
                      <span className="flex-1 truncate text-[13px] text-[var(--text)]">
                        <span className="font-mono text-[11px] text-[var(--text-dim)]">
                          {s.project_code}
                        </span>{' '}
                        {s.title_ar ?? s.project_title}
                        {s.client && (
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {' '}· {s.client}
                          </span>
                        )}
                      </span>
                      <StatusPill tone={stageTone(s.stage)}>
                        {stageLabelAr(s.stage)}
                      </StatusPill>
                    </Link>
                  ))}

                  {d.deliveries.map((dv, i) => (
                    <Link
                      key={`d-${i}`}
                      href={`/projects/${dv.project_id}`}
                      className="group flex items-center gap-3 rounded-md border border-[var(--warning)]/30 bg-[var(--warning)]/[0.05] px-3 py-2 hover:border-[var(--warning)]/60"
                    >
                      <CalendarClock
                        size={13}
                        className="text-[var(--warning)]"
                      />
                      <span className="text-[10px] uppercase tracking-wider text-[var(--warning)]">
                        تسليم
                      </span>
                      <span className="flex-1 truncate text-[13px] text-[var(--text)]">
                        <span className="font-mono text-[11px] text-[var(--text-dim)]">
                          {dv.project_code}
                        </span>{' '}
                        {dv.title_ar ?? dv.project_title}
                        {dv.client && (
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {' '}· {dv.client}
                          </span>
                        )}
                      </span>
                      <StatusPill tone={stageTone(dv.stage)}>
                        {stageLabelAr(dv.stage)}
                      </StatusPill>
                    </Link>
                  ))}

                  {d.reservations.map((r) => {
                    const startTime = r.starts_iso.slice(11, 16);
                    const endTime = r.ends_iso.slice(11, 16);
                    return (
                      <div
                        key={`r-${r.id}`}
                        className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/30 px-3 py-2"
                      >
                        <Truck size={13} className="text-[var(--info)]" />
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                          حجز
                        </span>
                        <span className="font-mono text-[11px] text-[var(--text-dim)]">
                          {startTime}–{endTime}
                        </span>
                        <span className="flex-1 truncate text-[13px] text-[var(--text)]">
                          {r.eq_code ? (
                            <>
                              <span className="font-mono text-[11px] text-[var(--text-dim)]">
                                {r.eq_code}
                              </span>{' '}
                              {r.eq_model}
                            </>
                          ) : (
                            'مجموعة معدات'
                          )}
                        </span>
                        {r.project_code && r.project_id && (
                          <Link
                            href={`/projects/${r.project_id}`}
                            className="font-mono text-[11px] text-[var(--accent)] hover:underline"
                          >
                            {r.project_code}
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

function StatBox({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: 'default' | 'warning';
}) {
  const numColor =
    tone === 'warning' ? 'text-[var(--warning)]' : 'text-[var(--text)]';
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
          {label}
        </span>
        <span className="text-[var(--text-dim)]">{icon}</span>
      </div>
      <p className={`mt-4 text-[36px] font-bold leading-none tabular ${numColor}`}>
        {value}
      </p>
    </div>
  );
}
