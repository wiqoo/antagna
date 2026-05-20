import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, StatusPill, EmptyState, Counter } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { FileText, TrendingUp, Briefcase } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/reports');

  const [revenueByMonth, stageBreakdown, topClients, teamLoad, eqUtilization] =
    await Promise.all([
      db.execute<{
        month: string;
        delivered_value: number;
        delivered_count: number;
      }>(sql`
        SELECT to_char(delivered_at, 'YYYY-MM') AS month,
               COALESCE(SUM(contracted_value_sar), 0)::numeric::float8 AS delivered_value,
               count(*)::int AS delivered_count
        FROM projects
        WHERE delivered_at IS NOT NULL
          AND delivered_at >= (now() - interval '12 months')
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 12
      `),
      db.execute<{ stage: string; count: number; value: number }>(sql`
        SELECT stage::text AS stage,
               count(*)::int AS count,
               COALESCE(SUM(contracted_value_sar), 0)::numeric::float8 AS value
        FROM projects
        WHERE archived_at IS NULL
        GROUP BY 1
        ORDER BY count DESC
      `),
      db.execute<{
        client_id: string;
        name_ar: string;
        code: string;
        delivered_value: number;
        active_projects: number;
        total_projects: number;
      }>(sql`
        SELECT c.id::text AS client_id, c.name_ar, c.code,
               COALESCE(SUM(p.contracted_value_sar)
                 FILTER (WHERE p.delivered_at IS NOT NULL), 0)::numeric::float8 AS delivered_value,
               count(*) FILTER (WHERE p.stage NOT IN ('delivered','archived','lost','cancelled'))::int AS active_projects,
               count(*)::int AS total_projects
        FROM clients c
        INNER JOIN projects p ON p.client_id = c.id
        WHERE c.archived_at IS NULL
        GROUP BY c.id
        ORDER BY delivered_value DESC
        LIMIT 10
      `),
      db.execute<{
        profile_id: string;
        display_name: string;
        active_assignments: number;
        total_assignments: number;
      }>(sql`
        SELECT p.id::text AS profile_id, p.display_name,
               count(*) FILTER (WHERE pr.stage NOT IN ('delivered','archived','lost','cancelled'))::int AS active_assignments,
               count(*)::int AS total_assignments
        FROM profiles p
        INNER JOIN project_assignments pa ON pa.profile_id = p.id
        INNER JOIN projects pr ON pr.id = pa.project_id
        WHERE p.archived_at IS NULL
        GROUP BY p.id
        HAVING count(*) > 0
        ORDER BY active_assignments DESC
        LIMIT 12
      `),
      db.execute<{ status: string; count: number }>(sql`
        SELECT status::text AS status, count(*)::int AS count
        FROM equipment
        WHERE archived_at IS NULL
        GROUP BY status
      `),
    ]);

  const revenueArr = revenueByMonth as unknown as Array<{
    month: string;
    delivered_value: number;
    delivered_count: number;
  }>;
  const stageArr = stageBreakdown as unknown as Array<{
    stage: string;
    count: number;
    value: number;
  }>;
  const clientArr = topClients as unknown as Array<{
    client_id: string;
    name_ar: string;
    code: string;
    delivered_value: number;
    active_projects: number;
    total_projects: number;
  }>;
  const teamArr = teamLoad as unknown as Array<{
    profile_id: string;
    display_name: string;
    active_assignments: number;
    total_assignments: number;
  }>;
  const eqArr = eqUtilization as unknown as Array<{
    status: string;
    count: number;
  }>;

  const totalRevenue12mo = revenueArr.reduce(
    (s, r) => s + Number(r.delivered_value),
    0,
  );
  const totalDelivered = revenueArr.reduce(
    (s, r) => s + Number(r.delivered_count),
    0,
  );
  const totalEqUnits = eqArr.reduce((s, r) => s + Number(r.count), 0);
  const utilized =
    Number(eqArr.find((s) => s.status === 'checked_out')?.count ?? 0) /
    Math.max(1, totalEqUnits);

  const maxRevenue = Math.max(
    ...revenueArr.map((r) => Number(r.delivered_value)),
    1,
  );

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/reports">
      <PageHeader
        eyebrow="Reports"
        title="التقارير"
        subtitle="إيراد، توزيع المراحل، توظيف الفريق و المعدات — على آخر 12 شهر."
      />

      <section className="grid grid-cols-1 gap-4 stagger-in md:grid-cols-3">
        <StatBox
          label="إيراد 12 شهر"
          value={totalRevenue12mo}
          format={(n) => `${n.toLocaleString('en-US', { maximumFractionDigits: 0 })} ر.س`}
          icon={<TrendingUp size={16} />}
          tone="accent"
        />
        <StatBox
          label="مشاريع مُسلَّمة"
          value={totalDelivered}
          icon={<Briefcase size={16} />}
        />
        <StatBox
          label="توظيف معدات"
          value={Math.round(utilized * 100)}
          format={(n) => `${n}%`}
          tone="warning"
          icon={<TrendingUp size={16} />}
        />
      </section>

      {/* Revenue chart (CSS bars) */}
      <section className="space-y-5">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
              — الإيرادات الشهرية
            </p>
            <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
              آخر 12 شهر
            </h2>
          </div>
        </header>
        {revenueArr.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileText size={18} />}
              title="لا توجد مشاريع مُسلَّمة بعد"
              description="هتظهر الإيرادات الشهرية هنا أول ما يتم تسليم أول مشروع."
            />
          </Card>
        ) : (
          <Card padded={false}>
            <div className="p-6">
              <div className="grid grid-cols-12 gap-2">
                {revenueArr
                  .slice()
                  .reverse()
                  .map((m) => {
                    const v = Number(m.delivered_value);
                    const pct = (v / maxRevenue) * 100;
                    return (
                      <div
                        key={m.month}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div className="flex h-32 w-full items-end">
                          <div
                            className="w-full rounded-t-md bg-gradient-to-t from-[var(--accent)] to-[var(--accent-hover)] transition-all"
                            style={{ height: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                        <p className="font-mono text-[10px] text-[var(--text-dim)]">
                          {m.month}
                        </p>
                        <p className="font-mono text-[10px] text-[var(--text-muted)]">
                          {v >= 1000 ? `${Math.round(v / 1000)}K` : v.toFixed(0)}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* Stage breakdown */}
      <section className="space-y-5">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
            — توزيع المراحل
          </p>
          <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
            كل المشاريع النشطة
          </h2>
        </header>
        {stageArr.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Briefcase size={18} />}
              title="لا توجد مشاريع"
              description=""
            />
          </Card>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-[var(--line)]">
              {stageArr.map((s) => (
                <li
                  key={s.stage}
                  className="grid grid-cols-[140px,1fr,auto] items-center gap-4 px-6 py-3"
                >
                  <span className="text-[12px] text-[var(--text)]">
                    {s.stage}
                  </span>
                  <div className="relative h-2 overflow-hidden rounded-full bg-[var(--surface)]">
                    <div
                      className="absolute inset-y-0 start-0 bg-[var(--accent)]"
                      style={{
                        width: `${(Number(s.count) / Math.max(...stageArr.map((x) => x.count))) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[13px] text-[var(--text)]">
                    {s.count}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Top clients */}
      <section className="space-y-5">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
            — أفضل العملاء
          </p>
          <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
            بناءً على المشاريع المُسلَّمة
          </h2>
        </header>
        {clientArr.length === 0 ? (
          <Card>
            <EmptyState icon={<Briefcase size={18} />} title="لا توجد بيانات" description="" />
          </Card>
        ) : (
          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/60 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                    <th className="px-5 py-3 text-start">العميل</th>
                    <th className="px-5 py-3 text-end">قيمة مُسلَّمة</th>
                    <th className="px-5 py-3 text-end">نشط</th>
                    <th className="px-5 py-3 text-end">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {clientArr.map((c) => (
                    <tr
                      key={c.client_id}
                      className="hover:bg-[var(--surface-hover)]"
                    >
                      <td className="px-5 py-3">
                        <a
                          href={`/clients/${c.client_id}`}
                          className="hover:text-[var(--accent)]"
                        >
                          <span className="font-mono text-[11px] text-[var(--text-dim)]">
                            {c.code}
                          </span>{' '}
                          {c.name_ar}
                        </a>
                      </td>
                      <td className="px-5 py-3 text-end font-mono text-[12px] text-[var(--text)]">
                        {Number(c.delivered_value).toLocaleString('en-US', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-5 py-3 text-end font-mono text-[12px]">
                        {c.active_projects}
                      </td>
                      <td className="px-5 py-3 text-end font-mono text-[12px] text-[var(--text-muted)]">
                        {c.total_projects}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* Team load */}
      <section className="space-y-5">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
            — توظيف الفريق
          </p>
          <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
            assignments نشطة
          </h2>
        </header>
        {teamArr.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Briefcase size={18} />}
              title="لا توجد تعيينات"
              description=""
            />
          </Card>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-[var(--line)]">
              {teamArr.map((t) => (
                <li
                  key={t.profile_id}
                  className="grid grid-cols-[1fr,auto,auto] items-center gap-4 px-6 py-3"
                >
                  <span className="text-[13px] text-[var(--text)]">
                    {t.display_name}
                  </span>
                  <StatusPill
                    tone={
                      t.active_assignments >= 4
                        ? 'danger'
                        : t.active_assignments >= 2
                          ? 'warning'
                          : 'success'
                    }
                  >
                    {t.active_assignments} نشط
                  </StatusPill>
                  <span className="font-mono text-[11px] text-[var(--text-dim)]">
                    {t.total_assignments} الإجمالي
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <Counter to={0} className="hidden" />
    </Shell>
  );
}

function StatBox({
  label,
  value,
  format,
  icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon: React.ReactNode;
  tone?: 'default' | 'accent' | 'warning';
}) {
  const num =
    tone === 'accent'
      ? 'text-[var(--accent)]'
      : tone === 'warning'
        ? 'text-[var(--warning)]'
        : 'text-[var(--text)]';
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
          {label}
        </p>
        <span className="text-[var(--text-dim)]">{icon}</span>
      </div>
      <p
        className={`mt-5 text-[36px] font-bold leading-none tracking-tight tabular ${num}`}
      >
        <Counter
          to={value}
          format={format}
        />
      </p>
    </div>
  );
}
