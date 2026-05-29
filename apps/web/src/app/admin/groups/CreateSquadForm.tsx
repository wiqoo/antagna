'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card } from '@antagna/ui';
import { SQUAD_PURPOSES, PURPOSE_LABEL_AR } from './constants';
import { createSquad } from './actions';

const inputCls =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]';
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--text-dim)]';

export function CreateSquadForm() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
      >
        <Plus size={14} />
        مجموعة جديدة
      </button>
    );
  }

  return (
    <Card className="border-[var(--accent)]/30">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">إنشاء مجموعة / Squad</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-[var(--surface-hover)]"
        >
          <X size={14} />
        </button>
      </div>
      <form action={createSquad} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>الرمز (code)</label>
          <input
            name="code"
            placeholder="CREW_A"
            pattern="[A-Za-z][A-Za-z0-9_]*"
            title="حروف وأرقام و _ فقط، يبدأ بحرف"
            className={`${inputCls} font-mono uppercase`}
            required
          />
        </div>
        <div>
          <label className={labelCls}>الغرض</label>
          <select name="purpose" defaultValue="" className={inputCls}>
            <option value="">— بدون —</option>
            {SQUAD_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {PURPOSE_LABEL_AR[p] ?? p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>الاسم (عربي)</label>
          <input name="name_ar" placeholder="طاقم التصوير أ" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>الاسم (إنجليزي)</label>
          <input name="name_en" placeholder="Crew A" className={inputCls} />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-9 rounded-md border border-[var(--line)] px-4 text-[12px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            إلغاء
          </button>
          <button
            type="submit"
            className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} />
            إنشاء
          </button>
        </div>
      </form>
    </Card>
  );
}
