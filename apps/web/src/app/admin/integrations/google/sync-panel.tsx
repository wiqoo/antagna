'use client';

import { useState } from 'react';
import { Loader2, DownloadCloud, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

type Report = {
  ok: boolean;
  report?: {
    mailbox: string;
    startedAt: string;
    finishedAt: string;
    query: string;
    threadsFetched: number;
    threadsProcessed: number;
    messagesInserted: number;
    messagesSkipped: number;
    errors: { gmailThreadId?: string; gmailMessageId?: string; error: string }[];
  };
  error?: string;
};

type SummarizeReport = {
  ok: boolean;
  report?: {
    startedAt: string;
    finishedAt: string;
    eligibleThreads: number;
    summarizedThreads: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCostUsd: number;
    threadsAutoClosed: number;
    threadsLinkedToClient: number;
    leadsCreated: number;
    errors: { threadId: string; error: string }[];
  };
  error?: string;
};

export function SyncPanel({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Report | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<SummarizeReport | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/integrations/gmail/sync?mailbox=${encodeURIComponent(email)}&sinceDays=7&maxThreads=50`,
        { method: 'POST' },
      );
      const json = (await res.json()) as Report;
      setResult(json);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function runSummarize() {
    setSummarizing(true);
    setSummary(null);
    try {
      const res = await fetch(`/api/integrations/gmail/summarize?maxThreads=30`, {
        method: 'POST',
      });
      const json = (await res.json()) as SummarizeReport;
      setSummary(json);
    } catch (err) {
      setSummary({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            مزامنة Gmail
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            يجلب آخر 7 أيام (حتى 50 thread) ويضيفها للـ /inbox
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <DownloadCloud size={12} />
          )}
          {loading ? 'يسحب…' : 'اسحب الإيميلات الآن'}
        </button>
      </div>

      {result && (
        <div className="mt-3">
          {result.report ? (
            <div className="rounded-md border border-[var(--success)]/30 bg-[var(--success)]/[0.05] p-3">
              <div className="flex items-center gap-2 text-[12px]">
                <CheckCircle2 size={13} className="text-[var(--success)]" />
                <span className="font-semibold text-[var(--text)]">تم</span>
                <span className="text-[var(--text-muted)]">
                  {result.report.threadsProcessed}/{result.report.threadsFetched} threads ·{' '}
                  {result.report.messagesInserted} رسالة جديدة ·{' '}
                  {result.report.messagesSkipped} موجودة
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-[var(--text-dim)] md:grid-cols-4">
                <Stat label="محادثات مجلوبة" value={result.report.threadsFetched} />
                <Stat label="محادثات معالَجة" value={result.report.threadsProcessed} />
                <Stat
                  label="رسائل جديدة"
                  value={result.report.messagesInserted}
                  tone="success"
                />
                <Stat label="رسائل متجاوَزة" value={result.report.messagesSkipped} />
              </div>
              <p className="mt-2 text-[10px] text-[var(--text-dim)]">
                <span className="font-mono">query: {result.report.query}</span> · بدأ{' '}
                {result.report.startedAt.slice(11, 19)} · انتهى{' '}
                {result.report.finishedAt.slice(11, 19)}
              </p>
              {result.report.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-[var(--danger)]">
                    ⚠ {result.report.errors.length} خطأ
                  </summary>
                  <ul className="mt-1 space-y-1 text-[10px] text-[var(--text-muted)]">
                    {result.report.errors.slice(0, 10).map((e, i) => (
                      <li key={i} className="font-mono">
                        {e.gmailMessageId ?? e.gmailThreadId ?? '?'}: {e.error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <a
                href="/inbox"
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] text-[var(--text)] hover:border-[var(--accent)]"
              >
                افتح /inbox →
              </a>
            </div>
          ) : (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/[0.05] p-3">
              <div className="flex items-start gap-2 text-[12px]">
                <AlertCircle size={13} className="mt-0.5 text-[var(--danger)]" />
                <span className="text-[var(--danger)]">{result.error}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summarize section */}
      <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            تلخيص AI
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Claude Haiku يقرأ كل thread جديد ويصنّفه + يلخّصه + يقترح إجراء
          </p>
        </div>
        <button
          type="button"
          onClick={runSummarize}
          disabled={summarizing}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
        >
          {summarizing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {summarizing ? 'يلخّص…' : 'لخّص الجديد'}
        </button>
      </div>

      {summary && (
        <div className="mt-3">
          {summary.report ? (
            <div className="rounded-md border border-[var(--success)]/30 bg-[var(--success)]/[0.05] p-3">
              <div className="flex items-center gap-2 text-[12px]">
                <CheckCircle2 size={13} className="text-[var(--success)]" />
                <span className="font-semibold text-[var(--text)]">تم</span>
                <span className="text-[var(--text-muted)]">
                  {summary.report.summarizedThreads}/{summary.report.eligibleThreads} threads ·{' '}
                  ${summary.report.estimatedCostUsd.toFixed(4)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-[var(--text-dim)] md:grid-cols-4">
                <Stat label="مؤهَّل" value={summary.report.eligibleThreads} />
                <Stat
                  label="مُلخَّصة"
                  value={summary.report.summarizedThreads}
                  tone="success"
                />
                <Stat label="رموز الإدخال" value={summary.report.totalInputTokens} />
                <Stat label="رموز الإخراج" value={summary.report.totalOutputTokens} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-[var(--text-dim)]">
                <Stat label="Auto-closed" value={summary.report.threadsAutoClosed} />
                <Stat label="Linked → client" value={summary.report.threadsLinkedToClient} />
                <Stat
                  label="فُرَص أُنشئت"
                  value={summary.report.leadsCreated}
                  tone="success"
                />
              </div>
              {summary.report.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-[var(--danger)]">
                    ⚠ {summary.report.errors.length} خطأ
                  </summary>
                  <ul className="mt-1 space-y-1 text-[10px] text-[var(--text-muted)]">
                    {summary.report.errors.slice(0, 10).map((e, i) => (
                      <li key={i} className="font-mono">
                        {e.threadId}: {e.error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/[0.05] p-3">
              <div className="flex items-start gap-2 text-[12px]">
                <AlertCircle size={13} className="mt-0.5 text-[var(--danger)]" />
                <span className="text-[var(--danger)]">{summary.error}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success';
}) {
  return (
    <div className="rounded border border-[var(--line)] bg-[var(--surface)]/40 p-2">
      <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">{label}</p>
      <p
        className={
          'mt-0.5 font-mono text-[14px] ' +
          (tone === 'success' ? 'text-[var(--success)]' : 'text-[var(--text)]')
        }
      >
        {value}
      </p>
    </div>
  );
}
