'use client';

import { useState, useTransition } from 'react';
import { Card, StatusPill } from '@antagna/ui';
import {
  CheckCircle2,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SuggestionItem {
  id: string;
  type: string;
  typeLabel: string;
  summary: string;
  confidence: number;
  proposedData: Record<string, unknown>;
  threadSubject: string | null;
  threadId: string | null;
  createdAt: string;
}

export function SuggestionsList({ items }: { items: SuggestionItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((s) => (
        <SuggestionCard key={s.id} item={s} />
      ))}
    </div>
  );
}

function SuggestionCard({ item }: { item: SuggestionItem }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const conf = item.confidence;
  const tier = conf >= 0.85 ? 'high' : conf >= 0.7 ? 'medium' : 'low';

  function call(action: 'approve' | 'approve_and_execute' | 'reject') {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/suggestions/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? 'failed');
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill
              tone={
                tier === 'high' ? 'success' : tier === 'medium' ? 'warning' : 'neutral'
              }
            >
              {item.typeLabel}
            </StatusPill>
            <span className="font-mono text-[10px] text-[var(--text-dim)]">
              {Math.round(conf * 100)}% confidence
            </span>
            {item.threadSubject && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <Mail size={9} /> {item.threadSubject.slice(0, 60)}
              </span>
            )}
          </div>
          <p className="mt-2 text-[13px] text-[var(--text)]">{item.summary}</p>
          <p className="mt-1 text-[10px] text-[var(--text-dim)] font-mono">
            {new Date(item.createdAt).toISOString().slice(0, 19).replace('T', ' ')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--text)]"
            title={expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            onClick={() => call('reject')}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] text-[var(--danger)] hover:border-[var(--danger)] disabled:opacity-50"
          >
            {pending ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
            رفض
          </button>
          <button
            onClick={() => call('approve_and_execute')}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-[11px] font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--accent-gradient)' }}
          >
            {pending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <CheckCircle2 size={11} />
            )}
            موافقة ونفّذ
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--surface)]/40 p-3">
          <pre className="overflow-x-auto text-[10px] leading-relaxed text-[var(--text-muted)]">
            {JSON.stringify(item.proposedData, null, 2)}
          </pre>
        </div>
      )}

      {error && (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--danger)]">
          <AlertTriangle size={11} /> {error}
        </p>
      )}
    </Card>
  );
}
