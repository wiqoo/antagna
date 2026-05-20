import clsx from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const DOT: Record<Tone, string> = {
  neutral: 'bg-[var(--text-dim)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  danger: 'bg-[var(--danger)]',
  info: 'bg-[var(--info)]',
  accent: 'bg-[var(--accent)]',
};

const TXT: Record<Tone, string> = {
  neutral: 'text-[var(--text-muted)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  danger: 'text-[var(--danger)]',
  info: 'text-[var(--info)]',
  accent: 'text-[var(--accent)]',
};

export function StatusPill({
  tone = 'neutral',
  children,
  withDot = true,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  withDot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium',
        TXT[tone],
        className,
      )}
    >
      {withDot && (
        <span className={clsx('h-1.5 w-1.5 rounded-full', DOT[tone])} aria-hidden />
      )}
      {children}
    </span>
  );
}
