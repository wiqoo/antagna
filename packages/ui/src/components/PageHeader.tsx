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
    <header className="fade-up space-y-3 pb-4">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          {eyebrow && (
            <p className="text-[12px] text-[var(--text-muted)]">{eyebrow}</p>
          )}
          <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--text)] md:text-[48px]">
            {title}
          </h1>
          {subtitle && (
            <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 pt-2">{action}</div>}
      </div>
    </header>
  );
}
