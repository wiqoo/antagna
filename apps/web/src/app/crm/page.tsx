import Link from 'next/link';
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
import { AppShell, StatusPill, MoneyDisplay } from '@antagna/ui';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const LEAD_STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger' | 'success'> = {
  new: 'info',
  qualified: 'warning',
  nurturing: 'warning',
  proposal_sent: 'accent' as never,
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
        // most recent health snapshot
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
      .orderBy(desc(sql`(SELECT MAX(created_at) FROM ${projects} WHERE client_id = ${clients.id})`))
      .limit(50),
    db
      .select({
        id: leads.id,
        code: leads.code,
        status: leads.status,
        source: leads.source,
        clientId: leads.clientId,
        unmatchedFromEmail: leads.unmatchedFromEmail,
        unmatchedFromName: leads.unmatchedFromName,
        estimatedValue: leads.estimatedValueSar,
        receivedAt: leads.receivedAt,
        aiSuggestedAction: leads.aiSuggestedAction,
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

  const totalActive = clientRows.reduce((s, c) => s + Number(c.activeProjects ?? 0), 0);

  return (
    <AppShell user={{ email: user.email ?? '' }} activePath="/crm">
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold">CRM</h1>
          <p className="text-sm text-neutral-500">
            {clientRows.length} عميل · {totalActive} مشروع نشط · {leadRows.length} lead مفتوح
          </p>
        </header>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wide text-neutral-500">
              Leads المفتوحة
            </h2>
          </div>
          <div className="overflow-hidden rounded-md border border-neutral-800">
            {leadRows.length === 0 ? (
              <div className="bg-neutral-950 px-3 py-6 text-center text-xs text-neutral-500">
                لا توجد leads مفتوحة.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-left text-[11px] uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">code</th>
                    <th className="px-3 py-2 font-medium">من</th>
                    <th className="px-3 py-2 font-medium">المصدر</th>
                    <th className="px-3 py-2 font-medium">temp</th>
                    <th className="px-3 py-2 font-medium">القيمة المتوقعة</th>
                    <th className="px-3 py-2 font-medium">المسؤول</th>
                    <th className="px-3 py-2 font-medium">الحالة</th>
                    <th className="px-3 py-2 font-medium">منذ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 bg-neutral-950">
                  {leadRows.map((l) => {
                    const ageDays = Math.floor(
                      (Date.now() - new Date(l.receivedAt).getTime()) / 86_400_000,
                    );
                    return (
                      <tr key={l.id} className="hover:bg-neutral-900">
                        <td className="px-3 py-2 font-mono text-xs text-neutral-400">
                          {l.code}
                        </td>
                        <td className="px-3 py-2">
                          {l.clientNameAr ?? l.unmatchedFromName ?? l.unmatchedFromEmail ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-neutral-400">{l.source ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {l.temperatureScore != null ? `${l.temperatureScore}/100` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-neutral-400">
                          {l.estimatedValue
                            ? `${Number(l.estimatedValue).toLocaleString('en-US')} ر.س`
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {l.assignedName ?? <span className="text-neutral-600">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill tone={LEAD_STATUS_TONE[l.status] ?? 'neutral'}>
                            {l.status}
                          </StatusPill>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                          {ageDays}d
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            العملاء
          </h2>
          <div className="overflow-hidden rounded-md border border-neutral-800">
            {clientRows.length === 0 ? (
              <div className="bg-neutral-950 px-3 py-6 text-center text-xs text-neutral-500">
                لا توجد عملاء. أضف العميل الأول من Pillar 15 (legacy merge) أو يدوياً.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-left text-[11px] uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">code</th>
                    <th className="px-3 py-2 font-medium">العميل</th>
                    <th className="px-3 py-2 font-medium">النوع</th>
                    <th className="px-3 py-2 font-medium">نشط</th>
                    <th className="px-3 py-2 font-medium">إيراد إجمالي</th>
                    <th className="px-3 py-2 font-medium">يوم سداد متوسط</th>
                    <th className="px-3 py-2 font-medium">trust</th>
                    <th className="px-3 py-2 font-medium">آخر مشروع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 bg-neutral-950">
                  {clientRows.map((c) => {
                    const lastProjDate = c.lastProjectAt
                      ? new Date(c.lastProjectAt).toISOString().slice(0, 10)
                      : '—';
                    return (
                      <tr key={c.id} className="hover:bg-neutral-900">
                        <td className="px-3 py-2 font-mono text-xs text-neutral-400">
                          {c.code}
                        </td>
                        <td className="px-3 py-2">
                          <div>{c.nameAr}</div>
                          {c.nameEn && (
                            <div className="text-xs text-neutral-500">{c.nameEn}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">{c.clientType}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {Number(c.activeProjects ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.totalRevenue ? (
                            <MoneyDisplay
                              amount={Number(c.totalRevenue)}
                              currency="SAR"
                              className="text-xs"
                            />
                          ) : (
                            <span className="text-xs text-neutral-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {c.averagePaymentDays != null ? `${c.averagePaymentDays}d` : '—'}
                        </td>
                        <td className="px-3 py-2">
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
                            <span className="text-xs text-neutral-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                          {lastProjDate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );

  void Link;
}
