import { redirect } from 'next/navigation';
import { sql, eq, asc } from 'drizzle-orm';
import { db, kpiDefinitions } from '@antagna/db';
import {
  
  PageHeader,
  Card,
  StatusPill,
  EmptyState,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { BarChart3 } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type KpiRow = {
  key: string;
  nameAr: string;
  nameEn: string | null;
  scope: string;
  unit: string;
  refreshFrequency: string;
  thresholdGreen: string | null;
  thresholdAmber: string | null;
  latestValue: string | null;
  latestComputedAt: Date | null;
};

const SCOPE_LABEL: Record<string, string> = {
  company: 'الشركة',
  project: 'المشاريع',
  person: 'الأفراد',
  client: 'العملاء',
};

export default async function KpisPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/kpis');

  const rows = await db
    .select({
      key: kpiDefinitions.key,
      nameAr: kpiDefinitions.nameAr,
      nameEn: kpiDefinitions.nameEn,
      scope: kpiDefinitions.scope,
      unit: kpiDefinitions.unit,
      refreshFrequency: kpiDefinitions.refreshFrequency,
      thresholdGreen: kpiDefinitions.thresholdGreen,
      thresholdAmber: kpiDefinitions.thresholdAmber,
      latestValue: sql<string | null>`(
        SELECT value::text FROM kpi_snapshots
        WHERE kpi_key = ${kpiDefinitions.key} AND scope_entity_id IS NULL
        ORDER BY computed_at DESC LIMIT 1
      )`,
      latestComputedAt: sql<Date | null>`(
        SELECT computed_at FROM kpi_snapshots
        WHERE kpi_key = ${kpiDefinitions.key} AND scope_entity_id IS NULL
        ORDER BY computed_at DESC LIMIT 1
      )`,
    })
    .from(kpiDefinitions)
    .where(eq(kpiDefinitions.active, true))
    .orderBy(asc(kpiDefinitions.scope), asc(kpiDefinitions.key));

  const byScope = rows.reduce<Record<string, KpiRow[]>>((acc, r) => {
    (acc[r.scope] ??= []).push(r);
    return acc;
  }, {});

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/kpis">
      <PageHeader
        eyebrow="KPIs"
        title="مؤشرات الأداء"
        subtitle={`${rows.length} KPI نشط · القيم تتحدث بـ pg_cron و Trigger.dev`}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BarChart3 size={20} />}
            title="لا توجد KPIs"
            description="ضيف تعريفات KPI من السكيمة لتفعيل التتبع."
          />
        </Card>
      ) : (
        Object.entries(byScope).map(([scope, items]) => (
          <section key={scope} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text)]">
                {SCOPE_LABEL[scope] ?? scope}
              </h2>
              <span className="text-xs text-[var(--text-dim)]">{items.length} KPI</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((k) => (
                <KpiCard key={k.key} k={k} />
              ))}
            </div>
          </section>
        ))
      )}
    </Shell>
  );
}

function KpiCard({ k }: { k: KpiRow }) {
  const numVal = k.latestValue != null ? Number(k.latestValue) : null;
  const green = k.thresholdGreen != null ? Number(k.thresholdGreen) : null;
  const amber = k.thresholdAmber != null ? Number(k.thresholdAmber) : null;

  let tone: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
  if (numVal != null && green != null && amber != null) {
    const higherBetter = green >= amber;
    if (higherBetter) {
      tone = numVal >= green ? 'success' : numVal >= amber ? 'warning' : 'danger';
    } else {
      tone = numVal <= green ? 'success' : numVal <= amber ? 'warning' : 'danger';
    }
  }

  const formatted =
    numVal == null
      ? '—'
      : k.unit === 'sar'
        ? `${numVal.toLocaleString('en-US')}`
        : k.unit === 'pct'
          ? `${(numVal * 100).toFixed(1)}%`
          : k.unit === 'days'
            ? `${numVal.toFixed(1)}`
            : numVal.toLocaleString('en-US');

  const unitLabel =
    k.unit === 'sar' ? 'ر.س' : k.unit === 'days' ? 'يوم' : k.unit === 'pct' ? '' : '';

  return (
    <Card className="!p-5 relative overflow-hidden group hover:border-[var(--line-strong)] hover:-translate-y-0.5">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--accent)]/[0.03] to-transparent" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-medium text-[var(--text)]">{k.nameAr}</h3>
            {k.nameEn && (
              <p className="text-xs text-[var(--text-dim)]">{k.nameEn}</p>
            )}
          </div>
          <StatusPill tone={tone}>{k.refreshFrequency}</StatusPill>
        </div>
        <div className="mt-5 flex items-baseline gap-2">
          <span className="font-mono text-4xl font-semibold tracking-tight text-[var(--text)]">
            {formatted}
          </span>
          {unitLabel && (
            <span className="text-sm text-[var(--text-dim)]">{unitLabel}</span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-dim)]">
          <span>{k.scope}</span>
          {k.latestComputedAt ? (
            <span className="font-mono">
              {new Date(k.latestComputedAt).toISOString().slice(0, 10)}
            </span>
          ) : (
            <span className="italic">pending</span>
          )}
        </div>
      </div>
    </Card>
  );
}
