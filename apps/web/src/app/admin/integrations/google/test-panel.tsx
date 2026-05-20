'use client';

import { useState } from 'react';
import { Loader2, Play, CheckCircle2, AlertCircle } from 'lucide-react';

type Result =
  | { ok: true; sample: unknown }
  | { ok: false; error: string };

type Report = {
  ok: boolean;
  email?: string;
  results?: { gmail: Result; drive: Result; calendar: Result };
  error?: string;
};

export function TestPanel({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  async function run() {
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch(
        `/api/integrations/google/test?email=${encodeURIComponent(email)}`,
      );
      const json = (await res.json()) as Report;
      setReport(json);
    } catch (err) {
      setReport({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
          اختبار الوصول
        </p>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? 'يجرّب…' : 'اختبر الآن'}
        </button>
      </div>

      {report && (
        <div className="mt-3 space-y-2">
          {report.results ? (
            <>
              <ServiceRow name="Gmail" r={report.results.gmail} />
              <ServiceRow name="Drive" r={report.results.drive} />
              <ServiceRow name="Calendar" r={report.results.calendar} />
            </>
          ) : (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/[0.05] p-2 text-[12px] text-[var(--danger)]">
              ⚠ {report.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ServiceRow({ name, r }: { name: string; r: Result }) {
  if (r.ok) {
    return (
      <div className="rounded-md border border-[var(--success)]/30 bg-[var(--success)]/[0.05] p-2.5">
        <div className="flex items-center gap-2 text-[12px]">
          <CheckCircle2 size={13} className="text-[var(--success)]" />
          <span className="font-semibold text-[var(--text)]">{name}</span>
          <span className="text-[var(--success)]">✓ يعمل</span>
        </div>
        <pre className="mt-1.5 overflow-x-auto text-[10px] text-[var(--text-muted)]">
          {JSON.stringify(r.sample, null, 2)}
        </pre>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/[0.05] p-2.5">
      <div className="flex items-center gap-2 text-[12px]">
        <AlertCircle size={13} className="text-[var(--danger)]" />
        <span className="font-semibold text-[var(--text)]">{name}</span>
        <span className="text-[var(--danger)]">فشل</span>
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{r.error}</p>
    </div>
  );
}
