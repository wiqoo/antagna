'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { refreshDashboardBoard } from './board-actions';

/** Manual "تحديث" — forces a board recompute (the board is served from a
 *  20-min cache otherwise, so it opens instantly). */
export function BoardRefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await refreshDashboardBoard();
          router.refresh();
        })
      }
      title="تحديث بيانات اللوحة"
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[var(--text-dim)] transition-colors hover:text-[var(--accent)] disabled:opacity-50"
    >
      <RefreshCw size={11} className={pending ? 'animate-spin' : ''} />
      {pending ? 'جارٍ التحديث…' : 'تحديث'}
    </button>
  );
}
