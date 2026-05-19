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
    <header className="fade-up flex flex-wrap items-end justify-between gap-6 border-b border-[--line] pb-8">
      <div className="space-y-3">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[--accent]">
            — {eyebrow}
          </p>
        )}
        <h1 className="text-[40px] font-bold leading-[1.05] tracking-tight text-[--text] md:text-[56px]">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-[14px] leading-relaxed text-[--text-muted]">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
