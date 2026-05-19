import clsx from 'clsx';
import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

type Trend = 'up' | 'down' | 'flat' | undefined;
type Tone = 'default' | 'accent' | 'success' | 'warning' | 'danger';

const TONE_CLASS: Record<Tone, string> = {
  default: 'from-[--surface]/80 to-[--surface]/40',
  accent: 'from-[#f5d60a]/15 to-transparent',
  success: 'from-emerald-500/15 to-transparent',
  warning: 'from-orange-500/15 to-transparent',
  danger: 'from-red-500/15 to-transparent',
};

const ICON_BG: Record<Tone, string> = {
  default: 'bg-[--surface-hover] text-[--text-muted]',
  accent: 'bg-[--accent]/15 text-[--accent]',
  success: 'bg-emerald-500/15 text-emerald-400',
  warning: 'bg-orange-500/15 text-orange-400',
  danger: 'bg-red-500/15 text-red-400',
};

export function StatTile({
  label,
  value,
  sub,
  icon,
  trend,
  tone = 'default',
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  trend?: Trend;
  tone?: Tone;
  href?: string;
}) {
  const inner = (
    <>
      <div
        className={clsx(
          'pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br opacity-80',
          TONE_CLASS[tone],
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-[--text-dim]">
            {label}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-[--text]">{value}</p>
          {sub && (
            <p className="flex items-center gap-1 text-xs text-[--text-muted]">
              {trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
              {sub}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={clsx(
              'flex h-10 w-10 items-center justify-center rounded-xl',
              ICON_BG[tone],
            )}
          >
            {icon}
          </div>
        )}
      </div>
      {href && (
        <ArrowRight className="absolute bottom-4 left-4 h-4 w-4 text-[--text-dim] opacity-0 transition-opacity group-hover:opacity-100 rtl:left-auto rtl:right-4 rtl:rotate-180" />
      )}
    </>
  );

  const className = clsx(
    'group relative overflow-hidden rounded-2xl border border-[--line] bg-[--surface]/60 p-5 backdrop-blur-xl',
    'shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-32px_rgba(0,0,0,0.6)]',
    href && 'cursor-pointer hover:border-[--line-strong] hover:-translate-y-0.5',
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}
