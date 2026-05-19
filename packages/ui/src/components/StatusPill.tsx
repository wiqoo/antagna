import clsx from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const DOT: Record<Tone, string> = {
  neutral: 'bg-[--text-dim]',
  success: 'bg-[--success]',
  warning: 'bg-[--warning]',
  danger: 'bg-[--danger]',
  info: 'bg-[--info]',
  accent: 'bg-[--accent]',
};

const TXT: Record<Tone, string> = {
  neutral: 'text-[--text-muted]',
  success: 'text-[--success]',
  warning: 'text-[--warning]',
  danger: 'text-[--danger]',
  info: 'text-[--info]',
  accent: 'text-[--accent]',
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
        'inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em]',
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
