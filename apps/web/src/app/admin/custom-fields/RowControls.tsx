'use client';

import { ArrowUp, ArrowDown, Power, Trash2 } from 'lucide-react';
import { toggleCustomField, moveCustomField, deleteCustomField } from './actions';

const btn =
  'grid h-7 w-7 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:border-[var(--line)]';

export function RowControls({
  id,
  active,
  isFirst,
  isLast,
}: {
  id: string;
  active: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        title="لأعلى"
        disabled={isFirst}
        onClick={() => moveCustomField(id, 'up')}
        className={btn}
      >
        <ArrowUp size={12} />
      </button>
      <button
        type="button"
        title="لأسفل"
        disabled={isLast}
        onClick={() => moveCustomField(id, 'down')}
        className={btn}
      >
        <ArrowDown size={12} />
      </button>
      <button
        type="button"
        title={active ? 'تعطيل' : 'تفعيل'}
        onClick={() => toggleCustomField(id)}
        className={
          active
            ? 'grid h-7 w-7 place-items-center rounded-md border border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]'
            : btn
        }
      >
        <Power size={12} />
      </button>
      <button
        type="button"
        title="حذف"
        onClick={() => {
          if (confirm('حذف هذا الحقل نهائياً؟ (متاح فقط إن لم تكن له قيم)')) {
            void deleteCustomField(id);
          }
        }}
        className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-red-500/50 hover:text-red-400"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
