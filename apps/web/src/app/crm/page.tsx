import { redirect } from 'next/navigation';
import { desc, eq, sql, isNull, and, ne } from 'drizzle-orm';
import {
  db,
  clients,
  leads,
  clientHealthSnapshots,
  projects,
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
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import Link from 'next/link';
import { Users, Flame, Building2, Plus } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';

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

export default async function CrmPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/crm');

  const [clientRows, leadRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        code: clients.code,
        nameAr: clients.nameAr,
        nameEn: clients.nameEn,
        clientType: clients.clientType,
        averagePaymentDays: clients.averagePaymentDays,
        trustScore: clients.trustScore,
        totalRevenue: sql<string | null>`(
          SELECT total_revenue_sar
          FROM ${clientHealthSnapshots}
          WHERE client_id = ${clients.id}
          ORDER BY snapshot_date DESC LIMIT 1
        )`,
        activeProjects: sql<number>`(
          SELECT COUNT(*)::int FROM ${projects}
          WHERE client_id = ${clients.id}
            AND stage NOT IN ('delivered','archived','lost','cancelled')
        )`,
        lastProjectAt: sql<Date | null>`(
          SELECT MAX(created_at) FROM ${projects}
          WHERE client_id = ${clients.id}
        )`,
      })
      .from(clients)
      .where(isNull(clients.archivedAt))
      .orderBy(
        desc(
          sql`(SELECT MAX(created_at) FROM ${projects} WHERE client_id = ${clients.id})`,
        ),
      )
      .limit(50),
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

  const totalActive = clientRows.reduce(
    (s, c) => s + Number(c.activeProjects ?? 0),
    0,
  );

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/crm">
      <PageHeader
        eyebrow="CRM"
        title="العملاء و الفرص"
        subtitle={`${clientRows.length} عميل · ${totalActive} مشروع نشط · ${leadRows.length} lead في الـ pipeline`}
        action={
          <Link
            href="/clients/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-black hover:bg-[var(--accent-hover)] active:scale-[0.98]"
          >
            <Plus size={16} />
            عميل جديد
          </Link>
        }
      />

      {/* Leads */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="فرص (leads) مفتوحة"
            subtitle="أحدث الـ leads في الـ funnel"
          />
        </div>
        {leadRows.length === 0 ? (
          <EmptyState
            icon={<Flame size={20} />}
            title="لا توجد leads مفتوحة"
            description="الـ leads هتظهر تلقائياً لما الـ inbound email routing يبدأ شغل (Pillar 8)."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">code</th>
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
                      <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">
                        {l.code}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text)]">
                        {l.clientNameAr ??
                          l.unmatchedFromName ??
                          l.unmatchedFromEmail ??
                          '—'}
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
            description="هيتم استيراد العملاء من legacy DB في Pillar 15."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">code</th>
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
                          className="font-mono text-xs text-[var(--text-dim)] hover:text-[var(--accent)]"
                        >
                          {c.code}
                        </Link>
                      </td>
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
                            {c.nameEn && (
                              <div className="text-xs text-[var(--text-dim)]">
                                {c.nameEn}
                              </div>
                            )}
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
