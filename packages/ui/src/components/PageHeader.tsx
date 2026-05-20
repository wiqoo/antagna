import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="fade-up flex items-end justify-between gap-4 border-b border-[var(--line)] pb-5">
      <div className="min-w-0 space-y-1.5">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            {eyebrow}
          </p>
        )}
        <h1
          className="text-[26px] font-bold leading-[1.15] tracking-[-0.018em] text-[var(--text)] md:text-[32px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
