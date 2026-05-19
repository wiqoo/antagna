import clsx from 'clsx';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Counter } from './Counter';

type Tone = 'default' | 'accent';

export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  href,
  animateTo,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  href?: string;
  animateTo?: number;
}) {
  const inner = (
    <>
      {/* Editorial label row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
          {label}
        </span>
        {icon && (
          <span className="text-[var(--text-dim)] group-hover:text-[var(--accent)]">
            {icon}
          </span>
        )}
      </div>

      {/* Big number */}
      <div className="mt-6 flex items-baseline gap-2">
        <span
          className={clsx(
            'text-[44px] font-bold leading-none tracking-tight tabular',
            tone === 'accent' ? 'text-[var(--accent)]' : 'text-[var(--text)]',
          )}
        >
          {animateTo != null ? <Counter to={animateTo} /> : value}
        </span>
      </div>

      {/* Sub label */}
      {sub && (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">{sub}</p>
      )}

      {href && (
        <ArrowUpRight
          size={14}
          className="absolute bottom-5 start-5 text-[var(--text-dim)] opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-[var(--accent)] rtl:rotate-180"
        />
      )}
    </>
  );

  const cls = clsx(
    'group relative overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-6 backdrop-blur',
    href && 'magnet cursor-pointer hover:border-[var(--line-strong)]',
  );

  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}
