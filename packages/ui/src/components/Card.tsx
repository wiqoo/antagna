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
        'rounded-lg border border-[--line] bg-[--bg-elevated]/60 backdrop-blur',
        padded && 'p-6',
        hover && 'magnet cursor-pointer hover:border-[--line-strong] hover:bg-[--bg-elevated]',
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
      ? 'text-lg font-semibold tracking-tight'
      : size === 'sm'
        ? 'text-sm font-semibold'
        : 'text-base font-semibold tracking-tight';
  return (
    <div className={clsx('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="space-y-1">
        <h2 className={clsx(titleCls, 'text-[--text]')}>{title}</h2>
        {subtitle && (
          <p className="text-[12px] leading-relaxed text-[--text-muted]">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
