'use client';

import { Power, Trash2 } from 'lucide-react';
import { toggleSquad, deleteSquad } from '../actions';

export function SquadSettings({ id, active }: { id: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => toggleSquad(id)}
        className={
          'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] ' +
          (active
            ? 'border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]'
            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)]')
        }
      >
        <Power size={12} />
        {active ? 'نشط' : 'معطّل'}
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm('حذف هذه المجموعة نهائياً؟ (متاح فقط إن لم تكن مسنَدة لمشاريع)')) {
            void deleteSquad(id);
          }
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text-dim)] hover:border-red-500/50 hover:text-red-400"
      >
        <Trash2 size={12} />
        حذف
      </button>
    </div>
  );
}
