'use client';

import { useState, useTransition } from 'react';
import { Loader2, Check } from 'lucide-react';
import { setMonthlyBudget } from '../actions';

export function BudgetEditor({ current, canManage }: { current: number; canManage: boolean }) {
  const [val, setVal] = useState(String(current ?? 0));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty = Number(val) !== current;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex items-center rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <span className="px-2.5 text-sm text-[var(--text-dim)]">$</span>
        <input
          type="number"
          min={0}
          step="1"
          value={val}
          disabled={!canManage}
          onChange={(e) => {
            setVal(e.target.value);
            setSaved(false);
          }}
          className="h-9 w-32 bg-transparent pe-3 text-end font-mono text-sm text-[var(--text)] outline-none disabled:opacity-50"
        />
        <span className="border-s border-[var(--line)] px-2.5 text-xs text-[var(--text-dim)]">/ شهر</span>
      </div>
      {canManage && (
        <button
          onClick={() =>
            start(async () => {
              await setMonthlyBudget(Number(val));
              setSaved(true);
            })
          }
          disabled={pending || !dirty}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          حفظ
        </button>
      )}
      {saved && !dirty && <span className="text-xs text-[var(--success)]">تم الحفظ</span>}
    </div>
  );
}
