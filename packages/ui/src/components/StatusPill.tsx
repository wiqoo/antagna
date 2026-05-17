import clsx from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-neutral-500',
  success: 'bg-[var(--color-success,#6cd29a)]',
  warning: 'bg-[var(--color-warning,#ff8b3d)]',
  danger: 'bg-[var(--color-danger,#ff5a5a)]',
  info: 'bg-[var(--color-info,#3dd8ff)]',
  accent: 'bg-[var(--color-accent,#f5d60a)]',
};

export function StatusPill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-sm border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-neutral-200',
        className,
      )}
    >
      <span className={clsx('h-2 w-2 rounded-full', TONE_DOT[tone])} />
      {children}
    </span>
  );
}
