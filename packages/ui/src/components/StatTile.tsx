import clsx from 'clsx';
import type { ReactNode } from 'react';
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
      <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
        <span>{label}</span>
        {icon && <span className="text-[var(--text-dim)]">{icon}</span>}
      </div>
      <div className="mt-3">
        <span
          className={clsx(
            'text-[28px] font-bold leading-none tracking-[-0.018em] tabular',
            tone === 'accent' ? 'text-[var(--accent)]' : 'text-[var(--text)]',
          )}
        >
          {animateTo != null ? <Counter to={animateTo} /> : value}
        </span>
      </div>
      {sub && <p className="mt-1 text-[11px] text-[var(--text-dim)]">{sub}</p>}
    </>
  );

  const cls = clsx(
    'block rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-4',
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
