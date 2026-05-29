import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  PageHeader,
  Card,
  CardHeader,
  StatBox,
  StatusPill,
  EmptyState,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import {
  ArrowLeft,
  Activity,
  TrendingUp,
  TrendingDown,
  Wrench,
  Layers,
  Clock,
  CalendarRange,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type UsageRow = {
  id: string;
  code: string;
  model: string | null;
  manufacturer: string | null;
  category: string;
  reservationCount: number;
  totalHours: number | null;
  lastUsedAt: string | null;
};

type CategoryRow = {
  category: string;
  units: number;
  available: number;
  reservations: number;
};

type RepairTimeRow = {
  id: string;
  code: string;
  model: string | null;
  manufacturer: string | null;
  repairCount: number;
  totalRepairDays: number | null;
  openRepairs: number;
};

type ActivityRow = { eventType: string; count: number };

/** Simple horizontal bar (no chart lib) — value as % of max. */
function Bar({
  value,
  max,
  tone = 'accent',
}: {
  value: number;
  max: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  const bg =
    tone === 'success'
      ? 'var(--success)'
      : tone === 'warning'
        ? 'var(--warning)'
        : tone === 'danger'
          ? 'var(--danger)'
          : 'var(--accent)';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: bg }}
      />
    </div>
  );
}

export default async function EquipmentMetricsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/equipment/metrics');

  const [totalsR, usageR, categoryR, repairR, activityR] = await Promise.all([
    // headline totals
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM equipment WHERE archived_at IS NULL)::int AS "totalUnits",
        (SELECT count(*) FROM equipment_reservations)::int             AS "totalReservations",
        (SELECT count(*) FROM equipment_reservations
           WHERE starts_at >= now() - interval '30 days')::int          AS "reservations30d",
        (SELECT count(*) FROM equipment_activity_log)::int             AS "activityEvents",
        (SELECT count(*) FROM equipment_repairs)::int                  AS "totalRepairs"
    `),
    // utilization per item — reservation count + total reserved hours + last use
    db.execute(sql`
      SELECT
        e.id::text       AS id,
        e.code           AS code,
        e.model          AS model,
        e.manufacturer   AS manufacturer,
        e.category       AS category,
        count(r.id)::int AS "reservationCount",
        COALESCE(SUM(EXTRACT(EPOCH FROM (r.ends_at - r.starts_at)) / 3600.0), 0)::float
                         AS "totalHours",
        MAX(r.starts_at) AS "lastUsedAt"
      FROM equipment e
      LEFT JOIN equipment_reservations r ON r.equipment_id = e.id
      WHERE e.archived_at IS NULL AND e.status <> 'retired'::equipment_status
      GROUP BY e.id, e.code, e.model, e.manufacturer, e.category
      ORDER BY count(r.id) DESC, e.code
    `),
    // by-category — units, available, reservation volume
    db.execute(sql`
      SELECT
        e.category                                                          AS category,
        count(DISTINCT e.id)::int                                           AS units,
        count(DISTINCT e.id) FILTER (WHERE e.status = 'available')::int     AS available,
        count(r.id)::int                                                    AS reservations
      FROM equipment e
      LEFT JOIN equipment_reservations r ON r.equipment_id = e.id
      WHERE e.archived_at IS NULL
      GROUP BY e.category
      ORDER BY count(r.id) DESC, count(DISTINCT e.id) DESC
    `),
    // in-repair time — total repair-days per item (sent→returned, or sent→now)
    db.execute(sql`
      SELECT
        e.id::text       AS id,
        e.code           AS code,
        e.model          AS model,
        e.manufacturer   AS manufacturer,
        count(rp.id)::int AS "repairCount",
        COALESCE(SUM(
          EXTRACT(EPOCH FROM (
            COALESCE(rp.returned_at, now()) - COALESCE(rp.sent_at, rp.reported_at)
          )) / 86400.0
        ), 0)::float     AS "totalRepairDays",
        count(rp.id) FILTER (WHERE rp.status <> 'returned')::int AS "openRepairs"
      FROM equipment e
      JOIN equipment_repairs rp ON rp.equipment_id = e.id
      GROUP BY e.id, e.code, e.model, e.manufacturer
      ORDER BY SUM(
        EXTRACT(EPOCH FROM (
          COALESCE(rp.returned_at, now()) - COALESCE(rp.sent_at, rp.reported_at)
        )) / 86400.0
      ) DESC NULLS LAST
      LIMIT 12
    `),
    // activity-log volume by event type
    db.execute(sql`
      SELECT event_type AS "eventType", count(*)::int AS count
      FROM equipment_activity_log
      GROUP BY event_type
      ORDER BY count(*) DESC
    `),
  ]);

  const totals = rows<{
    totalUnits: number;
    totalReservations: number;
    reservations30d: number;
    activityEvents: number;
    totalRepairs: number;
  }>(totalsR)[0] ?? {
    totalUnits: 0,
    totalReservations: 0,
    reservations30d: 0,
    activityEvents: 0,
    totalRepairs: 0,
  };

  const usage = rows<UsageRow>(usageR);
  const categories = rows<CategoryRow>(categoryR);
  const repairTimes = rows<RepairTimeRow>(repairR);
  const activity = rows<ActivityRow>(activityR);

  const used = usage.filter((u) => u.reservationCount > 0);
  const mostUsed = used.slice(0, 8);
  // least-used = never reserved (or lowest counts) among the catalog
  const neverUsed = usage.filter((u) => u.reservationCount === 0);
  const leastUsed = [...usage]
    .sort((a, b) => a.reservationCount - b.reservationCount || a.code.localeCompare(b.code))
    .slice(0, 8);

  const utilizationPct =
    totals.totalUnits > 0 ? Math.round((used.length / totals.totalUnits) * 100) : 0;
  const maxResv = mostUsed[0]?.reservationCount ?? 0;
  const maxCatResv = Math.max(1, ...categories.map((c) => c.reservations));
  const maxCatUnits = Math.max(1, ...categories.map((c) => c.units));
  const maxRepairDays = Math.max(1, ...repairTimes.map((r) => r.totalRepairDays ?? 0));
  const maxActivity = Math.max(1, ...activity.map((a) => a.count));
  const totalRepairDaysOpen = repairTimes.reduce((s, r) => s + (r.openRepairs > 0 ? r.totalRepairDays ?? 0 : 0), 0);

  const fmtModel = (r: { manufacturer: string | null; model: string | null; code: string }) =>
    [r.manufacturer, r.model].filter(Boolean).join(' ') || r.code;
  const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

  const hasAnyData = totals.totalReservations > 0 || totals.totalRepairs > 0 || totals.activityEvents > 0;

  // ── AI hints ───────────────────────────────────────────────────────────
  const hints: AIHint[] = [];
  if (neverUsed.length > 0 && totals.totalReservations > 0) {
    hints.push({
      index: '01',
      text: `${neverUsed.length} وحدة لم تُحجز ولا مرة`,
      insight: 'فكّر في إعادة توزيعها أو ضمّها لسِتب جاهز حتى لا تكون رأس مال راكد.',
      actions: [{ label: 'افتح بناء السِتب', href: '/equipment/kits' }],
    });
  }
  if (repairTimes.some((r) => r.openRepairs > 0)) {
    const openItems = repairTimes.filter((r) => r.openRepairs > 0).length;
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${openItems} وحدة عالقة في الصيانة حالياً`,
      insight: `إجمالي وقت التعطّل المفتوح ~${num.format(totalRepairDaysOpen)} يوم — تابِع الـ ETA.`,
      urgent: true,
      actions: [{ label: 'افتح الصيانة', href: '/equipment/repairs', primary: true }],
    });
  }
  if (mostUsed.length > 0 && mostUsed[0]!.reservationCount >= 3) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${fmtModel(mostUsed[0]!)} هي الأكثر استخداماً (${mostUsed[0]!.reservationCount} حجز)`,
      insight: 'الوحدات عالية الطلب قد تستفيد من وحدة احتياطية لتفادي التعارض.',
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/equipment">
      <Link
        href="/equipment"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> المعدات
      </Link>

      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · مؤشرات المعدات"
          headline={`${totals.totalUnits} وحدة · ${utilizationPct}% منها استُخدمت`}
          hints={hints}
          compact
        />
      )}

      <PageHeader
        eyebrow="Metrics / Utilization"
        title="مؤشرات استخدام المعدات"
        subtitle="من بيانات الحجوزات وسجلّ النشاط: الأكثر/الأقل استخداماً، وقت التعطّل في الصيانة، وتوزيع الفئات."
      />

      <section className="grid grid-cols-2 gap-4 stagger-in md:grid-cols-4">
        <StatBox
          label="إجمالي الوحدات"
          value={totals.totalUnits}
          sub="في الكتالوج النشط"
          icon={<Layers size={16} />}
        />
        <StatBox
          label="نسبة الاستخدام"
          value={utilizationPct}
          format={`${utilizationPct}%`}
          tone={utilizationPct >= 50 ? 'success' : utilizationPct > 0 ? 'warning' : 'default'}
          sub={`${used.length} وحدة لها حجز`}
          icon={<TrendingUp size={16} />}
        />
        <StatBox
          label="حجوزات (٣٠ يوم)"
          value={totals.reservations30d}
          sub={`${totals.totalReservations} إجمالي`}
          icon={<CalendarRange size={16} />}
        />
        <StatBox
          label="أحداث النشاط"
          value={totals.activityEvents}
          sub="تسليم/استرجاع/صيانة…"
          icon={<Activity size={16} />}
        />
      </section>

      {!hasAnyData && (
        <Card>
          <EmptyState
            icon={<Activity size={18} />}
            title="لا توجد بيانات استخدام بعد"
            description="بمجرد بدء حجز المعدات وتسليمها سيظهر هنا تحليل مَن الأكثر استخداماً، أوقات التعطّل، وتوزيع الفئات تلقائياً."
            action={
              <Link
                href="/equipment/reservations"
                className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                <CalendarRange size={14} />
                إدارة الحجوزات
              </Link>
            }
          />
        </Card>
      )}

      {/* most / least used */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card padded={false}>
          <div className="px-6 pt-6">
            <CardHeader
              title="الأكثر استخداماً"
              subtitle="بعدد الحجوزات (وإجمالي الساعات المحجوزة)"
            />
          </div>
          {mostUsed.length === 0 ? (
            <div className="px-6 pb-6 pt-2">
              <EmptyState
                icon={<TrendingUp size={16} />}
                title="لا حجوزات بعد"
                description="ابدأ بحجز معدّة من صفحة المشروع لترتيب الأكثر استخداماً."
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line)] border-t border-[var(--line)]">
              {mostUsed.map((u) => (
                <li key={u.id} className="px-6 py-3">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <Link
                      href={`/equipment/${u.id}`}
                      className="min-w-0 truncate text-[var(--text)] hover:text-[var(--accent)]"
                    >
                      <span className="me-1.5 font-mono text-[10px] text-[var(--text-dim)]">
                        {u.code}
                      </span>
                      {fmtModel(u)}
                    </Link>
                    <span className="shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
                      {u.reservationCount} حجز · {num.format(u.totalHours ?? 0)} س
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={u.reservationCount} max={maxResv} tone="success" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padded={false}>
          <div className="px-6 pt-6">
            <CardHeader
              title="الأقل استخداماً"
              subtitle="مرشّحة لإعادة التوزيع أو الضمّ لسِتب"
            />
          </div>
          {usage.length === 0 ? (
            <div className="px-6 pb-6 pt-2">
              <EmptyState
                icon={<TrendingDown size={16} />}
                title="الكتالوج فارغ"
                description="أضِف معدات أولاً لعرض الأقل استخداماً."
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line)] border-t border-[var(--line)]">
              {leastUsed.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 px-6 py-3 text-[12px]"
                >
                  <Link
                    href={`/equipment/${u.id}`}
                    className="min-w-0 truncate text-[var(--text)] hover:text-[var(--accent)]"
                  >
                    <span className="me-1.5 font-mono text-[10px] text-[var(--text-dim)]">
                      {u.code}
                    </span>
                    {fmtModel(u)}
                  </Link>
                  <span className="shrink-0">
                    {u.reservationCount === 0 ? (
                      <StatusPill tone="neutral" withDot={false}>
                        لم تُحجز
                      </StatusPill>
                    ) : (
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        {u.reservationCount} حجز
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* by category */}
      <section className="space-y-3">
        <CardHeader
          title="حسب الفئة"
          subtitle="عدد الوحدات وحجم الحجوزات لكل فئة"
        />
        {categories.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Layers size={16} />}
              title="لا فئات بعد"
              description="ستظهر هنا الفئات بمجرد إضافة معدات للكتالوج."
            />
          </Card>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-[var(--line)]">
              {categories.map((c) => (
                <li key={c.category} className="px-6 py-3.5">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="font-medium uppercase tracking-[0.1em] text-[var(--text)]">
                      {c.category}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--text-muted)]">
                      {c.units} وحدة · {c.available} متاح · {c.reservations} حجز
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_1fr] gap-3">
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                        الوحدات
                      </p>
                      <Bar value={c.units} max={maxCatUnits} tone="accent" />
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                        الحجوزات
                      </p>
                      <Bar value={c.reservations} max={maxCatResv} tone="success" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* in-repair time + activity volume */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card padded={false}>
          <div className="px-6 pt-6">
            <CardHeader
              title="وقت التعطّل في الصيانة"
              subtitle="إجمالي أيام الإصلاح لكل وحدة"
            />
          </div>
          {repairTimes.length === 0 ? (
            <div className="px-6 pb-6 pt-2">
              <EmptyState
                icon={<Wrench size={16} />}
                title="لا سجلّ صيانة"
                description="لم تُسجَّل أعطال بعد — وهذا جيّد. عند تسجيل إصلاح سيُحسب وقت التعطّل هنا."
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line)] border-t border-[var(--line)]">
              {repairTimes.map((r) => (
                <li key={r.id} className="px-6 py-3">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <Link
                      href={`/equipment/${r.id}`}
                      className="min-w-0 truncate text-[var(--text)] hover:text-[var(--accent)]"
                    >
                      <span className="me-1.5 font-mono text-[10px] text-[var(--text-dim)]">
                        {r.code}
                      </span>
                      {fmtModel(r)}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-[var(--text-muted)]">
                      <Clock size={11} />
                      {num.format(r.totalRepairDays ?? 0)} يوم
                      {r.openRepairs > 0 && (
                        <StatusPill tone="danger" withDot={false}>
                          مفتوح
                        </StatusPill>
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Bar
                      value={r.totalRepairDays ?? 0}
                      max={maxRepairDays}
                      tone={r.openRepairs > 0 ? 'danger' : 'warning'}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padded={false}>
          <div className="px-6 pt-6">
            <CardHeader
              title="حجم النشاط"
              subtitle="من سجلّ نشاط المعدات حسب نوع الحدث"
            />
          </div>
          {activity.length === 0 ? (
            <div className="px-6 pb-6 pt-2">
              <EmptyState
                icon={<Activity size={16} />}
                title="لا نشاط مُسجَّل"
                description="تسليم/استرجاع/شحن/تغيير حالة المعدات سيُسجَّل ويُجمَّع هنا."
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line)] border-t border-[var(--line)]">
              {activity.map((a) => (
                <li key={a.eventType} className="px-6 py-3">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="font-mono text-[var(--text)]">{a.eventType}</span>
                    <span className="font-mono text-[11px] text-[var(--text-muted)]">
                      {a.count}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={a.count} max={maxActivity} tone="accent" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Equipment · Metrics</span>
        <span>Volt Production · Jeddah</span>
      </div>
    </Shell>
  );
}
