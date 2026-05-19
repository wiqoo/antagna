import clsx from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/20',
  success: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20',
  warning: 'bg-orange-500/15 text-orange-300 ring-orange-500/25',
  danger: 'bg-red-500/15 text-red-300 ring-red-500/25',
  info: 'bg-blue-500/15 text-blue-300 ring-blue-500/20',
  accent: 'bg-[--accent]/20 text-[--accent] ring-[--accent]/30',
};

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-zinc-400',
  success: 'bg-emerald-400',
  warning: 'bg-orange-400',
  danger: 'bg-red-400',
  info: 'bg-blue-400',
  accent: 'bg-[--accent]',
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
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        TONE_CLASS[tone],
        className,
      )}
    >
      {withDot && (
        <span
          className={clsx('h-1.5 w-1.5 rounded-full', TONE_DOT[tone])}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
