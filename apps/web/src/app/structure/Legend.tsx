'use client';

import { DEPTS, DEPT_KEYS } from './org-data';

export function Legend() {
  return (
    <div className="absolute bottom-4 z-20 rounded-xl border border-[var(--line)] bg-[var(--surface)]/90 px-3 py-2.5 backdrop-blur" style={{ insetInlineStart: 16 }}>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">
        الأقسام
      </p>
      <div className="flex flex-col gap-1">
        {DEPT_KEYS.map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: DEPTS[k].color }} />
            <span className="text-[11px] text-[var(--text-muted)]">{DEPTS[k].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
