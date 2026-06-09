import { redirect } from 'next/navigation';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, EmptyState, StatusPill } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { FileText, Sparkles, ArrowLeft, Brain, CheckCircle2, AlertTriangle, Clock, FileCheck2 } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { getFormat } from '@/lib/format';
import {
  readCachedAnalyses,
  analyzeQuotation,
  deterministicAnalysis,
  isAnalysisFresh,
  QUOTE_STATUS_LABEL_AR,
  type QuoteState,
  type QuoteStatus,
  type QuotationAnalysis,
} from '@/lib/quotation-analysis';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  code: string;
  title: string;
  stage: string;
  quote_no: string;
  invoice_no: string | null;
  value_sar: string | null;
  quoted_at: string | null;
  client_id: string | null;
  client_name: string | null;
  last_email_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  am_name: string | null;
  pm_name: string | null;
};

const ACTIVE = new Set(['lead', 'brief', 'quoted', 'approved', 'planning', 'shooting', 'editing', 'review']);
const ANALYZE_CAP = 12; // cap fresh AI computes per page load (rest deterministic / next load)

const LIKELIHOOD_AR: Record<'high' | 'medium' | 'low', string> = { high: 'عالٍ', medium: 'متوسط', low: 'منخفض' };

/** Run async fn over items with bounded concurrency. */
async function mapLimit<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

const STATUS_TONE: Record<QuoteStatus, 'info' | 'warning' | 'danger' | 'success'> = {
  on_track: 'info',
  stalled: 'warning',
  at_risk: 'warning',
  no_client_response: 'danger',
  ready_to_invoice: 'success',
};

function relAr(iso: string | null): string {
  if (!iso) return 'لا يوجد';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return 'اليوم';
  if (d === 1) return 'أمس';
  return `منذ ${d} يوم`;
}

export default async function QuotationsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/quotations');
  const { profileId } = await requirePermission('project.read');
  const f = await getFormat();
  const fmtSar = (v: string | null) => f.currency(v == null || v === '' ? null : Number(v));

  const raw = (await db.execute(sql`
    WITH email_act AS (
      SELECT t.project_id,
        max(m.sent_at) AS last_email_at,
        max(m.sent_at) FILTER (WHERE m.direction = 'inbound')  AS last_inbound_at,
        max(m.sent_at) FILTER (WHERE m.direction = 'outbound') AS last_outbound_at
      FROM email_threads t JOIN email_messages m ON m.thread_id = t.id
      WHERE t.project_id IS NOT NULL
      GROUP BY t.project_id
    )
    SELECT p.id::text AS id, p.code, COALESCE(p.title, p.title_ar) AS title, p.stage,
      p.dafterah_quote_number AS quote_no, p.dafterah_invoice_number AS invoice_no,
      p.contracted_value_sar::text AS value_sar, p.quoted_at::text AS quoted_at,
      p.client_id::text AS client_id, COALESCE(c.name_ar, c.name_en) AS client_name,
      ea.last_email_at::text AS last_email_at, ea.last_inbound_at::text AS last_inbound_at, ea.last_outbound_at::text AS last_outbound_at,
      am.display_name AS am_name, pm.display_name AS pm_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN email_act ea ON ea.project_id = p.id
    LEFT JOIN profiles am ON am.id = p.account_manager_id
    LEFT JOIN profiles pm ON pm.id = p.project_manager_id
    WHERE p.archived_at IS NULL
      AND p.dafterah_quote_number IS NOT NULL AND btrim(p.dafterah_quote_number) <> ''
    ORDER BY (p.dafterah_invoice_number IS NOT NULL AND btrim(p.dafterah_invoice_number) <> '') ASC,
             COALESCE(ea.last_email_at, p.quoted_at, p.updated_at) ASC
    LIMIT 200
  `)) as unknown as Row[];

  const converted = raw.filter((r) => r.invoice_no && r.invoice_no.trim() !== '');
  const open = raw.filter((r) => (!r.invoice_no || r.invoice_no.trim() === '') && ACTIVE.has(r.stage));

  // Smart analysis — cache-first; only stale/missing quotes hit the brain + model.
  const toState = (r: Row): QuoteState => ({
    projectId: r.id, clientId: r.client_id, title: r.title, clientName: r.client_name, stage: r.stage,
    quoteNo: r.quote_no, invoiceNo: r.invoice_no, valueSar: r.value_sar, quotedAt: r.quoted_at,
    lastEmailAt: r.last_email_at, lastInboundAt: r.last_inbound_at, lastOutboundAt: r.last_outbound_at,
  });
  const cache = await readCachedAnalyses(open.map((r) => r.id));
  const states = new Map(open.map((r) => [r.id, toState(r)]));
  // Only stale/missing rows need a (possibly expensive) compute — cap how many
  // fresh computes one page load triggers; the rest render from cache.
  const stale = open.filter((r) => {
    const pre = cache.get(r.id);
    return !pre || !isAnalysisFresh(pre, states.get(r.id)!);
  });
  const computeIds = new Set(stale.slice(0, ANALYZE_CAP).map((r) => r.id));

  const analyses = new Map<string, QuotationAnalysis & { cached: boolean }>();
  // Non-compute rows resolve synchronously: fresh cache → cached; over-cap or
  // never-cached → cheap deterministic so EVERY open row always has a status.
  for (const r of open) {
    if (computeIds.has(r.id)) continue;
    const pre = cache.get(r.id);
    analyses.set(r.id, pre ? { ...pre.analysis, cached: true } : { ...deterministicAnalysis(states.get(r.id)!), cached: false });
  }
  // Compute the capped stale set with bounded concurrency (≤5 at a time).
  await mapLimit([...computeIds], 5, async (id) => {
    const pre = cache.get(id);
    try {
      analyses.set(
        id,
        await analyzeQuotation(states.get(id)!, {
          userId: profileId,
          cached: pre ? { inputHash: pre.inputHash, computedAt: pre.computedAt, analysis: pre.analysis } : undefined,
        }),
      );
    } catch {
      analyses.set(id, pre ? { ...pre.analysis, cached: true } : { ...deterministicAnalysis(states.get(id)!), cached: false });
    }
  });

  const openValue = open.reduce((s, r) => s + (r.value_sar ? Number(r.value_sar) : 0), 0);
  const needAction = open.filter((r) => {
    const a = analyses.get(r.id);
    return a && (a.status === 'stalled' || a.status === 'at_risk' || a.status === 'no_client_response');
  }).length;
  const readyInvoice = open.filter((r) => analyses.get(r.id)?.status === 'ready_to_invoice').length;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/quotations">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]">
        <ArrowLeft size={13} className="rtl:rotate-180" /> المشاريع
      </Link>

      <PageHeader
        eyebrow="عروض الأسعار"
        title={<span className="inline-flex items-center gap-2"><FileText size={18} className="text-[var(--accent)]" /> متابعة عروض الأسعار</span>}
        subtitle="إيه اللي اتحوّل لفاتورة وإيه اللي لسه عرض — مع تحليل ذكي مربوط بذاكرة الـ AI لكل عرض وخطوة المتابعة."
      />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<FileText size={15} />} label="عروض مفتوحة" value={open.length} />
        <Stat icon={<AlertTriangle size={15} />} label="تحتاج متابعة" value={needAction} tone="warning" />
        <Stat icon={<FileCheck2 size={15} />} label="جاهز للفوترة" value={readyInvoice} tone="success" />
        <Stat icon={<CheckCircle2 size={15} />} label="اتحوّل لفاتورة" value={converted.length} tone="success" />
      </div>
      <p className="-mt-1 text-[11px] text-[var(--text-dim)]">
        إجمالي قيمة العروض المفتوحة: <span className="font-mono text-[var(--text-muted)]">{fmtSar(String(openValue))}</span>
        <span className="mx-1.5">·</span>
        <Brain size={10} className="inline" /> التحليل مربوط بذاكرة العميل ومكاش (يتحدّث لما تتغيّر حالة العرض).
      </p>

      {/* Open quotes — smart */}
      <Card>
        <p className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text)]">
          <Sparkles size={14} className="text-[var(--accent)]" /> عروض مفتوحة ({open.length})
        </p>
        {open.length === 0 ? (
          <EmptyState icon={<FileText size={20} />} title="لا عروض مفتوحة" description="كل العروض اللي لها رقم اتحوّلت لفواتير، أو لسه مفيش عروض مسجّلة." />
        ) : (
          <div className="space-y-2.5">
            {open.map((r) => {
              const a = analyses.get(r.id);
              return (
                <div key={r.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)]/40 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/projects/${r.id}`} className="text-[13px] font-semibold text-[var(--text)] hover:text-[var(--accent)]">
                        {r.title}
                      </Link>
                      <p className="text-[11px] text-[var(--text-dim)]">
                        {r.client_name ?? '—'} <span className="font-mono">· {r.code} · عرض {r.quote_no}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                      <span className="font-mono text-[12px] text-[var(--text)]">{fmtSar(r.value_sar)}</span>
                      {a && <StatusPill tone={STATUS_TONE[a.status]}>{QUOTE_STATUS_LABEL_AR[a.status]}</StatusPill>}
                      {a && (
                        <span className="text-[10px] text-[var(--text-dim)]">
                          احتمال التحويل:{' '}
                          <span className={a.likelihood === 'high' ? 'font-medium text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
                            {LIKELIHOOD_AR[a.likelihood]}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {a && (
                    <div className="mt-2 space-y-1.5 rounded-md border border-[var(--accent)]/15 bg-[var(--accent)]/[0.03] p-2.5">
                      <p className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text)]" title={a.reasoningAr}>
                        {a.brainUsed && <Brain size={11} className="text-[var(--accent)]" />}
                        {a.headlineAr}
                      </p>
                      <p className="inline-flex items-center gap-1.5 text-[11px] text-[var(--accent)]">
                        <ArrowLeft size={11} className="rtl:rotate-180" /> {a.actionAr}
                      </p>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--text-dim)]">
                    <span><Clock size={9} className="inline" /> آخر إيميل {relAr(r.last_email_at)}</span>
                    <span>وارد {relAr(r.last_inbound_at)}</span>
                    <span>صادر {relAr(r.last_outbound_at)}</span>
                    {r.am_name && <span>· مدير الحساب: {r.am_name}</span>}
                    {r.pm_name && <span>· مدير المشروع: {r.pm_name}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Converted to invoices */}
      {converted.length > 0 && (
        <Card>
          <p className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text)]">
            <FileCheck2 size={14} className="text-[var(--success)]" /> اتحوّل لفواتير ({converted.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
                  <th className="px-2 py-2 text-start font-medium">المشروع</th>
                  <th className="px-2 py-2 text-start font-medium">العميل</th>
                  <th className="px-2 py-2 text-start font-medium">القيمة</th>
                  <th className="px-2 py-2 text-start font-medium">رقم العرض</th>
                  <th className="px-2 py-2 text-start font-medium">رقم الفاتورة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {converted.map((r) => (
                  <tr key={r.id} className="group hover:bg-[var(--surface-hover)]">
                    <td className="px-2 py-2">
                      <Link href={`/projects/${r.id}`} className="font-medium text-[var(--text)] group-hover:text-[var(--accent)]">{r.title}</Link>
                    </td>
                    <td className="px-2 py-2 text-[var(--text-muted)]">{r.client_name ?? '—'}</td>
                    <td className="px-2 py-2 font-mono">{fmtSar(r.value_sar)}</td>
                    <td className="px-2 py-2 font-mono text-[var(--text-dim)]">{r.quote_no}</td>
                    <td className="px-2 py-2 font-mono text-[var(--success)]">{r.invoice_no}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Shell>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: 'warning' | 'success' }) {
  const color = tone === 'warning' ? 'text-[var(--warning)]' : tone === 'success' ? 'text-[var(--success)]' : 'text-[var(--accent)]';
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/40 p-3">
      <span className={`inline-flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]`}>
        <span className={color}>{icon}</span> {label}
      </span>
      <p className={`mt-1 text-2xl font-semibold ${value > 0 && tone ? color : 'text-[var(--text)]'}`}>{value}</p>
    </div>
  );
}
