'use client';

import { useMemo, useState } from 'react';
import { Card, CardHeader, Avatar, StatusPill } from '@antagna/ui';

export interface UtilRow {
  id: string;
  displayName: string;
  positionKey: string | null;
  positionNameAr: string | null;
  departmentNameAr: string | null;
  activeProjects: number;
}

function loadTone(n: number, cap: number): 'success' | 'warning' | 'danger' | 'neutral' {
  if (n === 0) return 'neutral';
  if (n > cap) return 'danger';
  if (n >= cap) return 'warning';
  return 'success';
}

const TONE_BAR: Record<string, string> = {
  neutral: 'bg-[var(--line-strong)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  danger: 'bg-[var(--danger)]',
};

const TONE_LABEL: Record<string, string> = {
  neutral: 'متاح',
  success: 'حِمل صحي',
  warning: 'قرب السعة',
  danger: 'فوق السعة',
};

export function UtilizationHeatmap({ people, cap }: { people: UtilRow[]; cap: number }) {
  const [hideIdle, setHideIdle] = useState(false);

  const max = useMemo(
    () => Math.max(cap, ...people.map((p) => p.activeProjects), 1),
    [people, cap],
  );

  const shown = hideIdle ? people.filter((p) => p.activeProjects > 0) : people;

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
        <CardHeader title="خريطة الحِمل" subtitle={`${people.length} عضو · السقف ${cap} مشاريع`} />
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={hideIdle}
            onChange={(e) => setHideIdle(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          إخفاء بلا حِمل
        </label>
      </div>

      <ul className="divide-y divide-[var(--line)]">
        {shown.map((p) => {
          const tone = loadTone(p.activeProjects, cap);
          const pct = Math.min(100, Math.round((p.activeProjects / max) * 100));
          return (
            <li key={p.id} className="flex items-center gap-4 px-6 py-3.5">
              <Avatar name={p.displayName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-[var(--text)]">
                    {p.displayName}
                  </span>
                  {p.positionNameAr && (
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--text-dim)]">
                      {p.positionNameAr}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface)]">
                    <div
                      className={`h-full rounded-full transition-all ${TONE_BAR[tone]}`}
                      style={{ width: `${Math.max(pct, p.activeProjects > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-end font-mono text-[12px] tabular text-[var(--text-muted)]">
                    {p.activeProjects}
                  </span>
                </div>
              </div>
              <div className="hidden w-24 shrink-0 text-end sm:block">
                <StatusPill tone={tone} withDot={false}>
                  {TONE_LABEL[tone]}
                </StatusPill>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
