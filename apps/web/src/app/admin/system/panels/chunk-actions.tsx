'use client';

import { useTransition } from 'react';
import { Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { markUseful } from '../actions';

export function ChunkActions({
  id,
  useful,
  canManage,
}: {
  id: string;
  useful: boolean | null;
  canManage: boolean;
}) {
  const [pending, start] = useTransition();

  if (!canManage) {
    return useful == null ? (
      <span className="text-[10px] text-[var(--text-dim)]">—</span>
    ) : useful ? (
      <ThumbsUp size={12} className="ms-auto text-[var(--success)]" />
    ) : (
      <ThumbsDown size={12} className="ms-auto text-[var(--danger)]" />
    );
  }

  const base =
    'grid h-7 w-7 place-items-center rounded-md border transition-colors disabled:opacity-50 ';
  const idle = 'border-[var(--line)] text-[var(--text-dim)] hover:text-[var(--text)]';
  const upActive = 'border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]';
  const downActive = 'border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]';

  return (
    <div className="flex items-center justify-end gap-1">
      {pending && <Loader2 size={11} className="animate-spin text-[var(--text-dim)]" />}
      <button
        onClick={() => start(() => markUseful(id, true))}
        disabled={pending}
        title="مفيد"
        className={base + (useful === true ? upActive : idle)}
      >
        <ThumbsUp size={11} />
      </button>
      <button
        onClick={() => start(() => markUseful(id, false))}
        disabled={pending}
        title="غير مفيد"
        className={base + (useful === false ? downActive : idle)}
      >
        <ThumbsDown size={11} />
      </button>
    </div>
  );
}
