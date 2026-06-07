import { redirect } from 'next/navigation';
import { desc, eq, sql, and, ne } from 'drizzle-orm';
import {
  db,
  leads,
  profiles,
  vClientsSafe,
  withProfileScope,
} from '@antagna/db';
import { getEffectiveProfileId, requirePermission } from '@/lib/authz';
import { financialsHidden } from '@/lib/financials';
import {
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  Avatar,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import Link from 'next/link';
import {
  Users, Flame, Building2, Plus, Rows3, Columns3, Contact,
  Sparkles, FolderPlus, Network, ArrowRight, ExternalLink,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { LeadsBoard, type LeadRow } from './leads-board';
import { SuggestionsList } from '../inbox/suggestions/suggestions-list';

export const dynamic = 'force-dynamic';

const LEAD_STATUS_TONE: Record<
  string,
  'neutral' | 'info' | 'warning' | 'danger' | 'success' | 'accent'
> = {
  new: 'info', qualified: 'accent', nurturing: 'warning', proposal_sent: 'accent',
  won: 'success', lost: 'danger', ghosted: 'danger',
};

const SUGG_LABEL: Record<string, string> = {
  create_client: 'عميل جديد',
  create_contact: 'جهة اتصال',
  create_lead: 'فرصة (lead)',
};

type ClientRow = {
  id: string;
  code: string;
  nameAr: string | null;
  nameEn: string | null;
  clientType: string;
  isAgency: boolean;
  averagePaymentDays: number | null;
  trustScore: number | null;
  totalRevenue: string | null;
  activeProjects: number;
  lastProjectAt: string | null;
};

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const leadsView = sp.view === 'board' ? 'board' : 'table';

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/crm');

  await requirePermission('client.read');

  const effectivePid = await getEffectiveProfileId();

  // Masked reads (clients + leads→client) inside one withProfileScope txn.
  const { clientRowsRaw, leadRows } = await withProfileScope(effectivePid, async (tx) => {
    const clientRowsRaw = await tx.execute<{
      id: string; code: string; name_ar: string | null; name_en: string | null;
      client_type: string; is_agency: boolean; average_payment_days: number | null;
      trust_score: number | null; total_revenue: string | null;
      active_projects: number; last_project_at: string | null;
    }>(sql`
      SELECT c.id, c.code, c.name_ar, c.name_en, c.client_type, c.is_agency,
             c.average_payment_days, c.trust_score,
             snap.total_revenue_sar AS total_revenue,
             COALESCE(pa.active_projects, 0)::int AS active_projects,
             pa.last_project_at
      FROM v_clients_safe c
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (
                 WHERE p.stage NOT IN ('delivered','archived','lost','cancelled')
               )::int AS active_projects,
               MAX(p.created_at) AS last_project_at
        FROM projects p WHERE p.client_id = c.id
      ) pa ON TRUE
      LEFT JOIN LATERAL (
        SELECT s.total_revenue_sar FROM client_health_snapshots s
        WHERE s.client_id = c.id ORDER BY s.snapshot_date DESC LIMIT 1
      ) snap ON TRUE
      WHERE c.archived_at IS NULL
      ORDER BY pa.last_project_at DESC NULLS LAST
      LIMIT 200
    `);

    const leadRows = await tx
      .select({
        id: leads.id, code: leads.code, status: leads.status, source: leads.source,
        unmatchedFromEmail: leads.unmatchedFromEmail,
        unmatchedFromName: leads.unmatchedFromName,
        estimatedValue: leads.estimatedValueSar, receivedAt: leads.receivedAt,
        temperatureScore: leads.temperatureScore,
        clientId: leads.clientId,
        clientNameAr: vClientsSafe.nameAr, assignedName: profiles.displayName,
      })
      .from(leads)
      .leftJoin(vClientsSafe, eq(vClientsSafe.id, leads.clientId))
      .leftJoin(profiles, eq(profiles.id, leads.assignedToProfileId))
      .where(and(ne(leads.status, 'lost'), ne(leads.status, 'ghosted')))
      .orderBy(desc(leads.receivedAt))
      .limit(20);

    return { clientRowsRaw, leadRows };
  });

  // Non-masked side reads: pending email suggestions + agency↔brand links.
  const [suggRaw, linkRaw] = await Promise.all([
    db.execute<{
      id: string; suggestion_type: string; proposed_data: Record<string, unknown>;
      summary_ar: string | null; confidence: string | null; created_at: string;
      thread_subject: string | null; source_thread_id: string | null;
    }>(sql`
      SELECT s.id::text AS id, s.suggestion_type, s.proposed_data, s.summary_ar,
             s.confidence::text AS confidence, s.created_at::text AS created_at,
             et.subject AS thread_subject, s.source_thread_id::text AS source_thread_id
      FROM ai_suggestions s
      LEFT JOIN email_threads et ON et.id = s.source_thread_id
      WHERE s.status = 'pending'
        AND s.suggestion_type IN ('create_client','create_contact','create_lead')
      ORDER BY s.confidence DESC NULLS LAST, s.created_at DESC
      LIMIT 8
    `),
    db.execute<{ agency_id: string; brand_id: string }>(sql`
      SELECT agency_id::text AS agency_id, brand_id::text AS brand_id FROM agency_brand_links
    `),
  ]);

  const clientRows: ClientRow[] = (clientRowsRaw as unknown as Array<{
    id: string; code: string; name_ar: string | null; name_en: string | null;
    client_type: string; is_agency: boolean; average_payment_days: number | null;
    trust_score: number | null; total_revenue: string | null;
    active_projects: number; last_project_at: string | null;
  }>).map((r) => ({
    id: r.id, code: r.code, nameAr: r.name_ar, nameEn: r.name_en,
    clientType: r.client_type, isAgency: r.is_agency,
    averagePaymentDays: r.average_payment_days, trustScore: r.trust_score,
    totalRevenue: r.total_revenue, activeProjects: r.active_projects,
    lastProjectAt: r.last_project_at,
  }));

  const suggestions = (suggRaw as unknown as Array<{
    id: string; suggestion_type: string; proposed_data: Record<string, unknown>;
    summary_ar: string | null; confidence: string | null; created_at: string;
    thread_subject: string | null; source_thread_id: string | null;
  }>).map((s) => ({
    id: s.id,
    type: s.suggestion_type,
    typeLabel: SUGG_LABEL[s.suggestion_type] ?? s.suggestion_type,
    summary: s.summary_ar ?? '',
    confidence: Number(s.confidence ?? 0),
    proposedData: (s.proposed_data ?? {}) as Record<string, unknown>,
    threadSubject: s.thread_subject,
    threadId: s.source_thread_id,
    createdAt: s.created_at,
  }));

  // Agency → brands hierarchy.
  const links = linkRaw as unknown as Array<{ agency_id: string; brand_id: string }>;
  const brandsByAgency = new Map<string, string[]>();
  const brandLinked = new Set<string>();
  for (const l of links) {
    const arr = brandsByAgency.get(l.agency_id);
    if (arr) arr.push(l.brand_id);
    else brandsByAgency.set(l.agency_id, [l.brand_id]);
    brandLinked.add(l.brand_id);
  }
  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  const agencies = clientRows.filter((c) => c.isAgency);
  const directClients = clientRows.filter((c) => !c.isAgency && !brandLinked.has(c.id));

  const totalActive = clientRows.reduce((s, c) => s + Number(c.activeProjects ?? 0), 0);

  // Hints
  const coldLeads = leadRows.filter((l) => {
    const ageDays = Math.floor((Date.now() - new Date(l.receivedAt).getTime()) / 86_400_000);
    return ageDays >= 5 && ['new', 'qualified', 'nurturing'].includes(l.status);
  });
  const hotLeads = leadRows.filter(
    (l) => (l.temperatureScore ?? 0) >= 70 && ['new', 'qualified'].includes(l.status),
  );
  const inactiveClients = clientRows.filter((c) => {
    if (!c.lastProjectAt || Number(c.activeProjects ?? 0) > 0) return false;
    const days = Math.floor((Date.now() - new Date(c.lastProjectAt).getTime()) / 86_400_000);
    return days >= 60;
  });

  const hints: AIHint[] = [];
  if (suggestions.length > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${suggestions.length} اقتراح من البريد بانتظار مراجعتك`,
      insight: 'الـ AI استخرج عملاء/جهات اتصال/فرص من إيميلات — راجِع وأقرّ.',
      urgent: true,
      actions: [{ label: 'راجِع الاقتراحات', href: '#suggestions', primary: true }],
    });
  }
  if (hotLeads.length > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${hotLeads.length} lead بحرارة ٧٠+ بدون تحرك`,
      insight: 'الـ leads الساخنة تبرد بسرعة — يُنصح بعرض سعر سريع.',
      urgent: true,
      actions: [{ label: 'افتح الساخنة', href: '#leads', primary: true }],
    });
  }
  if (coldLeads.length > 0 && hints.length < 3) {
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
          headline={`${clientRows.length} عميل · ${agencies.length} وكالة · ${leadRows.length} lead`}
          hints={hints}
          compact
        />
      )}
      <PageHeader
        eyebrow="CRM"
        title="العملاء و الفرص"
        subtitle={`${clientRows.length} عميل · ${agencies.length} وكالة · ${totalActive} مشروع نشط · ${leadRows.length} lead`}
        action={
          <div className="flex gap-2">
            <Link
              href="/contacts"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)]"
            >
              <Contact size={16} /> جهات الاتصال
            </Link>
            <Link
              href="/clients/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] active:scale-[0.98]"
            >
              <Plus size={16} /> عميل جديد
            </Link>
          </div>
        }
      />

      {/* AI suggestions from email */}
      {suggestions.length > 0 && (
        <Card padded={false}>
          <div id="suggestions" className="p-6 pb-4">
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={15} className="text-[var(--accent)]" /> اقتراحات من البريد
                </span>
              }
              subtitle="عملاء / جهات اتصال / فرص استخرجها الـ AI — وافِق ليُنشئها أو ارفض"
              action={
                <Link href="/inbox/suggestions" className="text-[11px] font-medium text-[var(--accent)] hover:underline">
                  كل الاقتراحات →
                </Link>
              }
            />
          </div>
          <div className="px-6 pb-6">
            <SuggestionsList items={suggestions} />
          </div>
        </Card>
      )}

      {/* Leads */}
      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 p-6 pb-4">
          <CardHeader title="فرص (leads) مفتوحة" subtitle="أحدث الـ leads في الـ funnel" />
          <div className="inline-flex shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
            <Link
              href={{ pathname: '/crm', query: { view: 'table' } }}
              className={'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ' + (leadsView === 'table' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]')}
            >
              <Rows3 size={13} /> جدول
            </Link>
            <Link
              href={{ pathname: '/crm', query: { view: 'board' } }}
              className={'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ' + (leadsView === 'board' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]')}
            >
              <Columns3 size={13} /> لوحة
            </Link>
          </div>
        </div>
        {leadRows.length === 0 ? (
          <EmptyState icon={<Flame size={20} />} title="لا توجد leads مفتوحة" description="الـ leads تظهر تلقائياً من فرز البريد الوارد." />
        ) : leadsView === 'board' ? (
          <div className="px-6 pb-6"><LeadsBoard rows={leadRows as unknown as LeadRow[]} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">من</th>
                  <th className="px-5 py-3 text-start">temperature</th>
                  <th className="px-5 py-3 text-start">القيمة المتوقعة</th>
                  <th className="px-5 py-3 text-start">المسؤول</th>
                  <th className="px-5 py-3 text-start">الحالة</th>
                  <th className="px-5 py-3 text-start">العمر</th>
                  <th className="px-5 py-3 text-end">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {leadRows.map((l) => {
                  const ageDays = Math.floor((Date.now() - new Date(l.receivedAt).getTime()) / 86_400_000);
                  return (
                    <tr key={l.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-5 py-3.5">
                        <div className="text-[var(--text)]">
                          {l.clientNameAr ?? l.unmatchedFromName ?? l.unmatchedFromEmail ?? '—'}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-[var(--text-dim)] opacity-70">{l.code}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        {l.temperatureScore != null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                              <div className="h-full bg-gradient-to-r from-blue-400 via-orange-400 to-red-500" style={{ width: `${l.temperatureScore}%` }} />
                            </div>
                            <span className="font-mono text-xs text-[var(--text-muted)]">{l.temperatureScore}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-end font-mono text-xs text-[var(--text-muted)]">
                        {!financialsHidden() && l.estimatedValue ? `${Number(l.estimatedValue).toLocaleString('en-US')} ر.س` : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {l.assignedName ? (
                          <div className="flex items-center gap-2"><Avatar name={l.assignedName} size="sm" /><span className="text-xs">{l.assignedName}</span></div>
                        ) : <span className="text-xs text-[var(--text-dim)]">—</span>}
                      </td>
                      <td className="px-5 py-3.5"><StatusPill tone={LEAD_STATUS_TONE[l.status] ?? 'neutral'}>{l.status}</StatusPill></td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">{ageDays}d</td>
                      <td className="px-5 py-3.5 text-end">
                        {l.clientId ? (
                          <Link href={`/clients/${l.clientId}`} className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                            افتح العميل <ArrowRight size={11} className="rtl:rotate-180" />
                          </Link>
                        ) : (
                          <Link href={`/clients/new?leadId=${l.id}${l.unmatchedFromName ? `&name=${encodeURIComponent(l.unmatchedFromName)}` : ''}`} className="inline-flex items-center gap-1 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20">
                            حوّل لعميل <ArrowRight size={11} className="rtl:rotate-180" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Agencies (our direct client) with the brands under them */}
      {agencies.length > 0 && (
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Network size={15} className="text-[var(--accent)]" /> الوكالات
                </span>
              }
              subtitle="الوكالة عميلنا المباشر · وتحتها عملاؤها النهائيون (brands)"
              action={<span className="inline-flex items-center gap-1 text-xs text-[var(--text-dim)]"><Building2 size={12} />{agencies.length}</span>}
            />
          </div>
          <div className="space-y-3 px-6 pb-6">
            {agencies.map((a) => {
              const brandIds = brandsByAgency.get(a.id) ?? [];
              const brands = brandIds.map((id) => clientById.get(id)).filter(Boolean) as ClientRow[];
              return (
                <div key={a.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/30">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <Link href={`/clients/${a.id}`} className="flex min-w-0 items-center gap-3 hover:text-[var(--accent)]">
                      <Avatar name={a.nameAr ?? a.code} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-[var(--text)]">{a.nameAr ?? a.nameEn ?? a.code}</span>
                          <StatusPill tone="accent" withDot={false}>وكالة</StatusPill>
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-[var(--text-dim)]">
                          {a.code} · {brands.length} عميل نهائي · {a.activeProjects} مشروع نشط
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/clients/new?agencyId=${a.id}`} className="inline-flex items-center gap-1 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20">
                        <Plus size={11} /> عميل نهائي
                      </Link>
                      <Link href={`/clients/${a.id}`} className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                        افتح <ExternalLink size={10} />
                      </Link>
                    </div>
                  </div>
                  {brands.length > 0 && (
                    <ul className="border-t border-[var(--line)]">
                      {brands.map((b) => (
                        <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 ps-8 hover:bg-[var(--surface-hover)]">
                          <Link href={`/clients/${b.id}`} className="flex min-w-0 items-center gap-2 text-[13px] hover:text-[var(--accent)]">
                            <span className="text-[var(--text-dim)]">└</span>
                            <span className="truncate text-[var(--text)]">{b.nameAr ?? b.nameEn ?? b.code}</span>
                            <span className="font-mono text-[10px] text-[var(--text-dim)]">{b.activeProjects} نشط</span>
                          </Link>
                          <div className="flex items-center gap-1.5">
                            <Link href={`/clients/${b.id}`} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">افتح</Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Direct clients (no agency) */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title={agencies.length > 0 ? 'عملاء مباشرون' : 'العملاء'}
            subtitle="مرتبين حسب آخر مشروع"
            action={<span className="inline-flex items-center gap-1 text-xs text-[var(--text-dim)]"><Building2 size={12} />{directClients.length}</span>}
          />
        </div>
        {directClients.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="لا عملاء مباشرين"
            description="أضِف عميلاً، أو اربط العملاء بوكالاتهم."
            action={<Link href="/clients/new" className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"><Plus size={15} /> عميل جديد</Link>}
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
                  <th className="px-5 py-3 text-start">trust</th>
                  <th className="px-5 py-3 text-start">آخر مشروع</th>
                  <th className="px-5 py-3 text-end">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {directClients.map((c) => {
                  const lastProj = c.lastProjectAt ? new Date(c.lastProjectAt).toISOString().slice(0, 10) : '—';
                  return (
                    <tr key={c.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-5 py-3.5">
                        <Link href={`/clients/${c.id}`} className="flex items-center gap-3 hover:text-[var(--accent)]">
                          <Avatar name={c.nameAr ?? '—'} size="sm" />
                          <div>
                            <div className="font-medium text-[var(--text)]">{c.nameAr ?? '—'}</div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-dim)]">
                              {c.nameEn && <span>{c.nameEn}</span>}
                              {c.nameEn && <span>·</span>}
                              <span className="font-mono text-[10px] opacity-70">{c.code ?? '—'}</span>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5"><StatusPill tone="neutral">{c.clientType}</StatusPill></td>
                      <td className="px-5 py-3.5 font-mono text-sm">{Number(c.activeProjects ?? 0)}</td>
                      <td className="px-5 py-3.5 text-end">
                        {!financialsHidden() && c.totalRevenue ? (
                          <span className="font-mono text-xs text-[var(--text-muted)]">{Number(c.totalRevenue).toLocaleString('en-US')} ر.س</span>
                        ) : <span className="text-xs text-[var(--text-dim)]">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {c.trustScore != null ? (
                          <StatusPill tone={c.trustScore >= 70 ? 'success' : c.trustScore >= 40 ? 'warning' : 'danger'}>{c.trustScore}</StatusPill>
                        ) : <span className="text-xs text-[var(--text-dim)]">—</span>}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">{lastProj}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/projects/new`} className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                            <FolderPlus size={10} /> مشروع
                          </Link>
                          <Link href={`/clients/${c.id}`} className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                            افتح
                          </Link>
                        </div>
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
