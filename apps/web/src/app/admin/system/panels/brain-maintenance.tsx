'use client';

import { useState, useTransition } from 'react';
import { Card } from '@antagna/ui';
import { Loader2, Trash2, RefreshCw } from 'lucide-react';
import { pruneLowRelevance, requestReindex } from '../actions';

export function BrainMaintenance({
  prunable,
  canManage,
}: {
  prunable: number;
  canManage: boolean;
}) {
  const [pruning, startPrune] = useTransition();
  const [reindexing, startReindex] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!canManage) return null;

  return (
    <Card className="border-[var(--accent)]/20 bg-[var(--accent)]/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--text)]">صيانة الذاكرة</p>
          <p className="text-xs text-[var(--text-muted)]">
            التقليم يحذف المقاطع غير المُسترجَعة الأقدم من 30 يومًا. إعادة الفهرسة تُجدوَل على الـ worker (ليست فورية).
          </p>
          {msg && <p className="mt-1 text-xs text-[var(--success)]">{msg}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!confirm(`حذف ${prunable} مقطع غير مُسترجَع؟`)) return;
              startPrune(async () => {
                const n = await pruneLowRelevance();
                setMsg(`تم حذف ${n} مقطع.`);
              });
            }}
            disabled={pruning || prunable === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)] hover:border-[var(--danger)]/50 hover:text-[var(--danger)] disabled:opacity-50"
          >
            {pruning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            تقليم ({prunable})
          </button>
          <button
            onClick={() =>
              startReindex(async () => {
                await requestReindex();
                setMsg('تم تسجيل طلب إعادة الفهرسة — الـ worker هيتولّاها.');
              })
            }
            disabled={reindexing}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {reindexing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            طلب إعادة فهرسة
          </button>
        </div>
      </div>
    </Card>
  );
}
