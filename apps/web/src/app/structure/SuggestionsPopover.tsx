'use client';

import { SUGGESTIONS, DEPTS, type Dept } from './org-data';

interface Props {
  targetName: string;
  onPick: (item: { name: string; role: string }, dept: Dept) => void;
  onClose: () => void;
}

export function SuggestionsPopover({ targetName, onPick, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        className="absolute top-16 z-40 max-h-[70vh] w-[300px] overflow-y-auto rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] p-3 shadow-2xl"
        style={{ insetInlineEnd: 16 }}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">أدوار مقترحة</h3>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text)]">
            ✕
          </button>
        </div>
        <p className="mb-3 text-[11px] text-[var(--text-muted)]">
          تُضاف كشاغر تحت: <span className="text-[var(--accent)]">{targetName || '—'}</span>
        </p>
        <div className="flex flex-col gap-3">
          {SUGGESTIONS.map((group, gi) => (
            <div key={gi}>
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: DEPTS[group.dept].color }} />
                <p className="text-[11px] font-medium text-[var(--text-muted)]">{group.label}</p>
              </div>
              <div className="flex flex-col gap-1">
                {group.items.map((item, ii) => (
                  <button
                    key={ii}
                    onClick={() => onPick(item, group.dept)}
                    className="flex items-center justify-between rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-start transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hover)]"
                  >
                    <span className="text-[12px]">{item.role}</span>
                    <span className="text-[10px] text-[var(--text-dim)]">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
