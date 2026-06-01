'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, RefreshCw, CheckCircle2, Send, TrendingUp, AlertTriangle,
  Target, Trophy, ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, StatusPill, EmptyState } from '@antagna/ui';
import {
  generateWeeklyReport,
  approveAndSendWeeklyReport,
  type WeeklyReportRow,
  type WeeklyReportKpi,
} from './weekly-report-actions';

const STATUS_TONE: Record<WeeklyReportKpi['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  green: 'success', amber: 'warning', red: 'danger', na: 'neutral',
};
const UNIT_SUFFIX: Record<string, string> = { pct: '٪', hours: ' س', ratio: '/٥', days: ' ي', sar: ' ر.س', count: '' };

function fmtVal(k: WeeklyReportKpi): string {
  if (k.value === null || k.status === 'na') return '—';
  return `${k.value}${UNIT_SUFFIX[k.unit] ?? ''}`;
}

export function WeeklyReportCard({ initial }: { initial: WeeklyReportRow | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const report = initial;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? 'تعذّر التنفيذ');
    });

  // No report yet for this week → offer to generate.
  if (!report) {
    return (
      <Card>
        <CardHeader title="التقرير الأسبوعي" subtitle="تقييم ذكي لأدائك مقابل وصفك الوظيفي" />
        <EmptyState
          icon={<Sparkles size={20} />}
          title="لا تقرير لهذا الأسبوع بعد"
          description="يولّد الـ AI تقريراً يقيس شغلك الفعلي مقابل مسؤولياتك ومؤشّراتك."
        />
        {error && <p className="mt-2 text-[12px] text-[var(--danger)]">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(generateWeeklyReport)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles size={14} /> {pending ? 'جارٍ التوليد…' : 'ولّد تقريري الأسبوعي'}
        </button>
      </Card>
    );
  }

  const c = report.content;
  const statusBadge =
    report.status === 'sent'
      ? <StatusPill tone="success">أُرسل للمدير</StatusPill>
      : report.status === 'approved'
        ? <StatusPill tone="info">معتمد</StatusPill>
        : <StatusPill tone="neutral">مسودّة</StatusPill>;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <CardHeader title="التقرير الأسبوعي" subtitle={c.headline} />
        {statusBadge}
      </div>

      {c.summary_ar && (
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{c.summary_ar}</p>
      )}

      {/* KPIs */}
      {c.kpis?.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {c.kpis.map((k) => (
            <div key={k.key} className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-3">
              <div className="flex items-center justify-between">
                <span className="truncate text-[11px] text-[var(--text-muted)]">{k.label}</span>
                <StatusPill tone={STATUS_TONE[k.status]}>
                  {k.status === 'na' ? 'لاحقاً' : k.status === 'green' ? 'ممتاز' : k.status === 'amber' ? 'متوسط' : 'متعثّر'}
                </StatusPill>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-[18px] font-semibold text-[var(--text)]">{fmtVal(k)}</span>
                <span className="text-[10px] text-[var(--text-dim)]">الهدف {k.target}{UNIT_SUFFIX[k.unit] ?? ''}</span>
              </div>
              {k.note && <p className="mt-1 text-[10px] leading-snug text-[var(--text-dim)]">{k.note}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Wins / Concerns / Focus */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ListBlock icon={<Trophy size={13} className="text-emerald-400" />} title="إنجازات" items={c.wins} empty="—" />
        <ListBlock icon={<AlertTriangle size={13} className="text-amber-400" />} title="ملاحظات / متعثّر" items={c.concerns} empty="لا ملاحظات" />
        <ListBlock icon={<Target size={13} className="text-[var(--accent)]" />} title="تركيز الأسبوع القادم" items={c.focus_next_week} empty="—" />
      </div>

      {error && <p className="mt-3 text-[12px] text-[var(--danger)]">{error}</p>}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
        {report.status === 'draft' && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => approveAndSendWeeklyReport())}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {report.managerNameAr ? <Send size={14} /> : <CheckCircle2 size={14} />}
              {pending ? '…' : report.managerNameAr ? `اعتمد وأرسل لـ ${report.managerNameAr}` : 'اعتمد التقرير'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(generateWeeklyReport)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] px-3 py-2 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
            >
              <RefreshCw size={13} /> أعد التوليد
            </button>
          </>
        )}
        {report.status !== 'draft' && report.sentAt && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-dim)]">
            <CheckCircle2 size={13} className="text-emerald-400" />
            أُرسل {report.managerNameAr ? `لـ ${report.managerNameAr} ` : ''}
            {new Date(report.sentAt).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
          </span>
        )}
        <span className="ms-auto text-[10px] text-[var(--text-dim)]">
          آخر تحديث {new Date(report.generatedAt).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </Card>
  );
}

function ListBlock({
  icon, title, items, empty,
}: { icon: React.ReactNode; title: string; items?: string[]; empty: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
        {icon} {title}
      </div>
      {items && items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[12px] leading-snug text-[var(--text)]">
              <ArrowRight size={11} className="mt-0.5 shrink-0 text-[var(--text-dim)] rtl:rotate-180" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-[var(--text-dim)]">{empty}</p>
      )}
    </div>
  );
}
