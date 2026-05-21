'use client';

import { useTransition } from 'react';
import { Loader2, Power, Trash2 } from 'lucide-react';
import { toggleRoute, deleteRoute } from './actions';

export function RouteActions({
  ruleId,
  active,
}: {
  ruleId: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => startTransition(() => toggleRoute(ruleId, !active))}
        disabled={pending}
        title={active ? 'تعطيل' : 'تفعيل'}
        className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--text)] disabled:opacity-50"
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : <Power size={11} />}
      </button>
      <button
        onClick={() => {
          if (!confirm('متأكد من الحذف؟')) return;
          startTransition(() => deleteRoute(ruleId));
        }}
        disabled={pending}
        title="حذف"
        className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--danger)] disabled:opacity-50"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}
