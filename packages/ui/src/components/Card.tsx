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
        'rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]',
        padded && 'p-5',
        hover && 'magnet cursor-pointer hover:border-[var(--line-strong)]',
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
  size = 'md',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const titleCls =
    size === 'lg'
      ? 'text-[18px] font-semibold tracking-[-0.014em]'
      : size === 'sm'
        ? 'text-[13px] font-semibold'
        : 'text-[15px] font-semibold tracking-[-0.012em]';
  return (
    <div className={clsx('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="space-y-0.5">
        <h2 className={clsx(titleCls, 'text-[var(--text)]')}>{title}</h2>
        {subtitle && (
          <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
