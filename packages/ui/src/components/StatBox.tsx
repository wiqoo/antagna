import type { ReactNode } from 'react';
import { Counter } from './Counter';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'accent';

const TONE_COLOR: Record<Tone, string> = {
  default: 'text-[var(--text)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  danger: 'text-[var(--danger)]',
  accent: 'text-[var(--accent)]',
};

/**
 * Single big-number stat tile. Consolidated from the per-page copies that
 * lived in /equipment, /team, /reports, /calendar, /social so every page
 * gets the same skin + animated count without drift.
 */
export function StatBox({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  animated = true,
  format,
}: {
  label: string;
  value: number;
  sub?: string;
  icon?: ReactNode;
  tone?: Tone;
  /** Off for places where the snap-to-number look is preferred (e.g. tables). */
  animated?: boolean;
  /** Pre-formatted display string (currency, percent, large-number grouping)
   *  — overrides `value`/`animated`. */
  format?: string;
}) {
  const numColor = TONE_COLOR[tone];
  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-6 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
          {label}
        </span>
        {icon && <span className="text-[var(--text-dim)]">{icon}</span>}
      </div>
      <div className="mt-5">
        <span
          className={`text-[44px] font-bold leading-none tracking-tight tabular ${numColor}`}
        >
          {format ? format : animated ? <Counter to={value} /> : value}
        </span>
      </div>
      {sub && <p className="mt-2 text-[11px] text-[var(--text-muted)]">{sub}</p>}
    </div>
  );
}
