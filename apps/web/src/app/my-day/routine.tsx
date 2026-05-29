'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Circle, Sunrise, Sun, Sunset, Clock } from 'lucide-react';
import { completeTask } from './actions';

export type RoutineRow = {
  /** daily_tasks.id */
  id: string;
  title: string;
  when: 'morning' | 'midday' | 'evening' | 'anytime';
  done: boolean;
};

const WHEN_META: Record<
  RoutineRow['when'],
  { label: string; Icon: typeof Sunrise }
> = {
  morning: { label: 'الصباح', Icon: Sunrise },
  midday: { label: 'الظهر', Icon: Sun },
  evening: { label: 'المساء', Icon: Sunset },
  anytime: { label: 'أي وقت', Icon: Clock },
};

const ORDER: RoutineRow['when'][] = ['morning', 'midday', 'evening', 'anytime'];

export function RoutineChecklist({ initial }: { initial: RoutineRow[] }) {
  const [rows, setRows] = useState<RoutineRow[]>(initial);
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const next = !target.done;

    // Optimistic flip.
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, done: next } : r)));

    startTransition(async () => {
      try {
        const res = await completeTask(id, next);
        if (!res?.ok) throw new Error('failed');
      } catch {
        // Roll back on failure.
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, done: !next } : r)));
      }
    });
  }

  const doneCount = rows.filter((r) => r.done).length;
  const total = rows.length;

  // Group by time-of-day; only render groups that have rows.
  const groups = ORDER.map((w) => ({
    when: w,
    rows: rows.filter((r) => r.when === w),
  })).filter((g) => g.rows.length > 0);

  return (
    <div>
      {/* progress */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: total ? `${(doneCount / total) * 100}%` : '0%' }}
          />
        </div>
        <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">
          {doneCount}/{total}
        </span>
      </div>

      <div className="flex flex-col gap-5">
        {groups.map((g) => {
          const { label, Icon } = WHEN_META[g.when];
          return (
            <div key={g.when}>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">
                <Icon size={12} />
                {label}
              </div>
              <ul className="overflow-hidden rounded-lg border border-[var(--line)] divide-y divide-[var(--line)]">
                {g.rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-right hover:bg-[var(--surface-hover)]"
                    >
                      <span
                        className={
                          r.done
                            ? 'text-emerald-400'
                            : 'text-[var(--text-dim)] group-hover:text-[var(--accent)]'
                        }
                      >
                        {r.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </span>
                      <span
                        className={
                          r.done
                            ? 'min-w-0 flex-1 text-sm text-[var(--text-dim)] line-through'
                            : 'min-w-0 flex-1 text-sm text-[var(--text)]'
                        }
                      >
                        {r.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
