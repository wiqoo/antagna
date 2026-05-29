import { redirect } from 'next/navigation';
import { desc, eq, sql, and, ne } from 'drizzle-orm';
import {
  db,
  clients,
  leads,
  profiles,
} from '@antagna/db';
import {

  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  MoneyDisplay,
  EmptyState,
  Avatar,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import Link from 'next/link';
import { Users, Flame, Building2, Plus, Rows3, Columns3 } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { LeadsBoard, type LeadRow } from './leads-board';

export const dynamic = 'force-dynamic';

const LEAD_STATUS_TONE: Record<
  string,
  'neutral' | 'info' | 'warning' | 'danger' | 'success' | 'accent'
> = {
  new: 'info',
  qualified: 'accent',
  nurturing: 'warning',
  proposal_sent: 'accent',
  won: 'success',
  lost: 'danger',
  ghosted: 'danger',
};

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const leadsView = sp.view === 'board' ? 'board' : 'table';

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/crm');

  const [clientRowsRaw, leadRows] = await Promise.all([
    // PERF (audit fix): the 3 per-row correlated scalar subqueries (latest
    // health snapshot, active-project COUNT, MAX(created_at)) plus the
    // correlated ORDER BY MAX() ran one extra index scan per client per metric.
    // Replaced with ONE LEFT JOIN LATERAL over a grouped projects aggregate and
    // a LATERAL latest-snapshot lookup — each evaluated once per client row.
    // Same output columns the JSX consumes.
    db.execute<{
      id: string;
      code: string;
      name_ar: string | null;
      name_en: string | null;
      client_type: string;
      average_payment_days: number | null;
      trust_score: number | null;
      total_revenue: string | null;
      active_projects: number;
      last_project_at: string | null;
    }>(sql`
      SELECT
        c.id,
        c.code,
        c.name_ar,
        c.name_en,
        c.client_type,
        c.average_payment_days,
        c.trust_score,
        snap.total_revenue_sar      AS total_revenue,
        COALESCE(pa.active_projects, 0)::int AS active_projects,
        pa.last_project_at
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE p.stage NOT IN ('delivered','archived','lost','cancelled')
          )::int AS active_projects,
          MAX(p.created_at) AS last_project_at
        FROM projects p
        WHERE p.client_id = c.id
      ) pa ON TRUE
      LEFT JOIN LATERAL (
        SELECT s.total_revenue_sar
        FROM client_health_snapshots s
        WHERE s.client_id = c.id
        ORDER BY s.snapshot_date DESC
        LIMIT 1
      ) snap ON TRUE
      WHERE c.archived_at IS NULL
      ORDER BY pa.last_project_at DESC NULLS LAST
      LIMIT 50
    `),
    db
      .select({
        id: leads.id,
        code: leads.code,
        status: leads.status,
        source: leads.source,
        unmatchedFromEmail: leads.unmatchedFromEmail,
        unmatchedFromName: leads.unmatchedFromName,
        estimatedValue: leads.estimatedValueSar,
        receivedAt: leads.receivedAt,
        temperatureScore: leads.temperatureScore,
        clientNameAr: clients.nameAr,
        assignedName: profiles.displayName,
      })
      .from(leads)
      .leftJoin(clients, eq(clients.id, leads.clientId))
      .leftJoin(profiles, eq(profiles.id, leads.assignedToProfileId))
      .where(and(ne(leads.status, 'lost'), ne(leads.status, 'ghosted')))
      .orderBy(desc(leads.receivedAt))
      .limit(20),
  ]);

  // Map the raw LATERAL rows to the camelCase shape the JSX consumes.
  const clientRows = (clientRowsRaw as unknown as Array<{
    id: string;
    code: string;
    name_ar: string | null;
    name_en: string | null;
    client_type: string;
    average_payment_days: number | null;
    trust_score: number | null;
    total_revenue: string | null;
    active_projects: number;
    last_project_at: string | null;
  }>).map((r) => ({
    id: r.id,
    code: r.code,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    clientType: r.client_type,
    averagePaymentDays: r.average_payment_days,
    trustScore: r.trust_score,
    totalRevenue: r.total_revenue,
    activeProjects: r.active_projects,
    lastProjectAt: r.last_project_at,
  }));

  const totalActive = clientRows.reduce(
    (s, c) => s + Number(c.activeProjects ?? 0),
    0,
  );

  // Derive hints from data
  const coldLeads = leadRows.filter((l) => {
    const ageDays = Math.floor((Date.now() - new Date(l.receivedAt).getTime()) / 86_400_000);
    return ageDays >= 5 && (l.status === 'new' || l.status === 'qualified' || l.status === 'nurturing');
  });
  const hotLeads = leadRows.filter(
    (l) => (l.temperatureScore ?? 0) >= 70 && (l.status === 'new' || l.status === 'qualified'),
  );
  const inactiveClients = clientRows.filter((c) => {
    if (!c.lastProjectAt || Number(c.activeProjects ?? 0) > 0) return false;
    const days = Math.floor((Date.now() - new Date(c.lastProjectAt).getTime()) / 86_400_000);
    return days >= 60;
  });

  const hints: AIHint[] = [];
  if (hotLeads.length > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${hotLeads.length} lead بحرارة ٧٠+ بدون تحرك`,
      insight: 'الـ leads الساخنة تبرد بسرعة — يُنصح بعرض سعر سريع.',
      urgent: true,
      actions: [{ label: 'افتح الساخنة', href: '#leads', primary: true }],
    });
  }
  if (coldLeads.length > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${coldLeads.length} lead بارد ٥+ أيام`,
      insight: 'متابعة واحد ممكن يرجّعه؛ بعدها سجّله ghosted.',
      actions: [{ label: 'اعرض الباردة', href: '#leads' }],
    });
  }
  if (inactiveClients.length > 0 && hints.length < 3) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${inactiveClients.length} عميل بدون مشروع نشط ٦٠+ يوم`,
      insight: 'فرصة لتجديد العلاقة — رسالة تذكير أو استطلاع.',
      actions: [{ label: 'افتح القائمة', href: '#clients' }],
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/crm">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · CRM"
          headline={`${clientRows.length} عميل · ${leadRows.length} lead — ${hints.length} يحتاج تحرك`}
          hints={hints}
          compact
        />
      )}
      <PageHeader
        eyebrow="CRM"
        title="العملاء و الفرص"
        subtitle={`${clientRows.length} عميل · ${totalActive} مشروع نشط · ${leadRows.length} lead في المسار`}
        action={
          <Link
            href="/clients/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] active:scale-[0.98]"
          >
            <Plus size={16} />
            عميل جديد
          </Link>
        }
      />

      {/* Leads */}
      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 p-6 pb-4">
          <CardHeader
            title="فرص (leads) مفتوحة"
            subtitle="أحدث الـ leads في الـ funnel"
          />
          <div className="inline-flex shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
            <Link
              href={{ pathname: '/crm', query: { view: 'table' } }}
              className={
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ' +
                (leadsView === 'table'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]')
              }
            >
              <Rows3 size={13} /> جدول
            </Link>
            <Link
              href={{ pathname: '/crm', query: { view: 'board' } }}
              className={
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ' +
                (leadsView === 'board'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]')
              }
            >
              <Columns3 size={13} /> لوحة
            </Link>
          </div>
        </div>
        {leadRows.length === 0 ? (
          <EmptyState
            icon={<Flame size={20} />}
            title="لا توجد leads مفتوحة"
            description="الـ leads ستظهر تلقائياً لما الـ inbound email routing يبدأ بالعمل (Pillar 8)."
          />
        ) : leadsView === 'board' ? (
          <div className="px-6 pb-6">
            <LeadsBoard rows={leadRows as unknown as LeadRow[]} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">من</th>
                  <th className="px-5 py-3 text-start">المصدر</th>
                  <th className="px-5 py-3 text-start">temperature</th>
                  <th className="px-5 py-3 text-start">القيمة المتوقعة</th>
                  <th className="px-5 py-3 text-start">المسؤول</th>
                  <th className="px-5 py-3 text-start">الحالة</th>
                  <th className="px-5 py-3 text-start">العمر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {leadRows.map((l) => {
                  const ageDays = Math.floor(
                    (Date.now() - new Date(l.receivedAt).getTime()) / 86_400_000,
                  );
                  return (
                    <tr key={l.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-5 py-3.5">
                        <div className="text-[var(--text)]">
                          {l.clientNameAr ??
                            l.unmatchedFromName ??
                            l.unmatchedFromEmail ??
                            '—'}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-[var(--text-dim)] opacity-70">
                          {l.code}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[var(--text-muted)]">
                        {l.source ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {l.temperatureScore != null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                              <div
                                className="h-full bg-gradient-to-r from-blue-400 via-orange-400 to-red-500"
                                style={{ width: `${l.temperatureScore}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs text-[var(--text-muted)]">
                              {l.temperatureScore}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-end font-mono text-xs text-[var(--text-muted)]">
                        {l.estimatedValue
                          ? `${Number(l.estimatedValue).toLocaleString('en-US')} ر.س`
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {l.assignedName ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={l.assignedName} size="sm" />
                            <span className="text-xs">{l.assignedName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-dim)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill tone={LEAD_STATUS_TONE[l.status] ?? 'neutral'}>
                          {l.status}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">
                        {ageDays}d
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Clients */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="العملاء"
            subtitle="مرتبين حسب آخر مشروع"
            action={
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-dim)]">
                <Building2 size={12} />
                {clientRows.length}
              </span>
            }
          />
        </div>
        {clientRows.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="لا توجد عملاء بعد"
            description="سيتم استيراد العملاء من legacy DB في Pillar 15."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">العميل</th>
                  <th className="px-5 py-3 text-start">النوع</th>
                  <th className="px-5 py-3 text-start">نشط</th>
                  <th className="px-5 py-3 text-start">إجمالي الإيراد</th>
                  <th className="px-5 py-3 text-start">يوم سداد متوسط</th>
                  <th className="px-5 py-3 text-start">trust</th>
                  <th className="px-5 py-3 text-start">آخر مشروع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {clientRows.map((c) => {
                  const lastProj = c.lastProjectAt
                    ? new Date(c.lastProjectAt).toISOString().slice(0, 10)
                    : '—';
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer hover:bg-[var(--surface-hover)]"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/clients/${c.id}`}
                          className="flex items-center gap-3 hover:text-[var(--accent)]"
                        >
                          <Avatar name={c.nameAr} size="sm" />
                          <div>
                            <div className="font-medium text-[var(--text)]">
                              {c.nameAr}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-dim)]">
                              {c.nameEn && <span>{c.nameEn}</span>}
                              {c.nameEn && <span>·</span>}
                              <span className="font-mono text-[10px] opacity-70">{c.code}</span>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill tone="neutral">{c.clientType}</StatusPill>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-sm">
                        {Number(c.activeProjects ?? 0)}
                      </td>
                      <td className="px-5 py-3.5 text-end">
                        {c.totalRevenue ? (
                          <MoneyDisplay
                            amount={Number(c.totalRevenue)}
                            currency="SAR"
                            className="text-xs"
                          />
                        ) : (
                          <span className="text-xs text-[var(--text-dim)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs">
                        {c.averagePaymentDays != null
                          ? `${c.averagePaymentDays}d`
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {c.trustScore != null ? (
                          <StatusPill
                            tone={
                              c.trustScore >= 70
                                ? 'success'
                                : c.trustScore >= 40
                                  ? 'warning'
                                  : 'danger'
                            }
                          >
                            {c.trustScore}
                          </StatusPill>
                        ) : (
                          <span className="text-xs text-[var(--text-dim)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">
                        {lastProj}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  );
}
