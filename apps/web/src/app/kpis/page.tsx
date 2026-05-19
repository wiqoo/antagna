import { redirect } from 'next/navigation';
import { sql, eq, asc } from 'drizzle-orm';
import { db, kpiDefinitions } from '@antagna/db';
import { AppShell, StatusPill } from '@antagna/ui';
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
  latestPeriodEnd: string | null;
  latestComputedAt: Date | null;
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
      latestPeriodEnd: sql<string | null>`(
        SELECT period_end FROM kpi_snapshots
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
    <AppShell user={{ email: user.email ?? '' }} activePath="/kpis">
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold">KPIs</h1>
          <p className="text-sm text-neutral-500">
            {rows.length} KPI نشط. القيم تحدّث بـ pg_cron + Trigger.dev (لما يُنشر).
          </p>
        </header>

        {Object.entries(byScope).map(([scope, items]) => (
          <section key={scope}>
            <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              {scope} ({items.length})
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((k) => (
                <KpiCard key={k.key} k={k} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}

function KpiCard({ k }: { k: KpiRow }) {
  const numVal = k.latestValue != null ? Number(k.latestValue) : null;
  const green = k.thresholdGreen != null ? Number(k.thresholdGreen) : null;
  const amber = k.thresholdAmber != null ? Number(k.thresholdAmber) : null;

  // higher-is-better assumption when green > amber, lower-is-better otherwise
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
        ? `${numVal.toLocaleString('en-US')} ر.س`
        : k.unit === 'pct'
          ? `${(numVal * 100).toFixed(1)}%`
          : k.unit === 'days'
            ? `${numVal.toFixed(1)} يوم`
            : numVal.toLocaleString('en-US');

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium">{k.nameAr}</h3>
          {k.nameEn && <p className="text-xs text-neutral-500">{k.nameEn}</p>}
        </div>
        <StatusPill tone={tone}>{k.unit}</StatusPill>
      </div>
      <p className="mt-3 text-3xl font-semibold font-mono">{formatted}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{k.refreshFrequency}</span>
        {k.latestComputedAt ? (
          <span className="font-mono">
            {new Date(k.latestComputedAt).toISOString().slice(0, 10)}
          </span>
        ) : (
          <span className="italic">pending compute</span>
        )}
      </div>
    </div>
  );
}
