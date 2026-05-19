import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Card({
  children,
  className,
  padded = true,
  hover = false,
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  hover?: boolean;
  as?: 'div' | 'section' | 'article' | 'a';
}) {
  return (
    <As
      className={clsx(
        'rounded-2xl border border-[--line] bg-[--surface]/60 backdrop-blur-xl',
        'shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-32px_rgba(0,0,0,0.6)]',
        padded && 'p-6',
        hover &&
          'cursor-pointer hover:bg-[--surface-hover] hover:border-[--line-strong] hover:-translate-y-0.5',
        className,
      )}
    >
      {children}
    </As>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold text-[--text]">{title}</h2>
        {subtitle && <p className="text-sm text-[--text-muted]">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
