'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface RefreshResult {
  ok: boolean;
  sync?: {
    threadsFetched: number;
    threadsProcessed: number;
    messagesInserted: number;
  };
  summary?: {
    summarizedThreads: number;
    deepExtractions: number;
    suggestionsGenerated: number;
    leadsCreated: number;
    threadsAutoClosed: number;
    estimatedCostUsd: number;
  };
  error?: string;
}

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [last, setLast] = useState<RefreshResult | null>(null);

  function run() {
    setLast(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/integrations/email-intel/refresh', {
          method: 'POST',
        });
        const json = (await res.json()) as RefreshResult;
        setLast(json);
        if (json.ok) router.refresh();
      } catch (err) {
        setLast({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--accent-gradient)' }}
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <RefreshCw size={14} />
        )}
        {pending ? 'يحلّل…' : 'تحديث الآن'}
      </button>

      {last && last.ok && last.summary && (
        <div className="inline-flex items-center gap-1.5 text-[10px] text-[var(--success)]">
          <CheckCircle2 size={10} />
          <span className="font-mono">
            +{last.summary.suggestionsGenerated} اقتراح ·{' '}
            {last.summary.deepExtractions} تحليل · ${last.summary.estimatedCostUsd.toFixed(4)}
          </span>
        </div>
      )}
      {last && !last.ok && (
        <div className="inline-flex items-center gap-1.5 text-[10px] text-[var(--danger)]">
          <AlertTriangle size={10} />
          {last.error}
        </div>
      )}
    </div>
  );
}
