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
    <header className="flex flex-wrap items-end justify-between gap-6 pb-2">
      <div className="space-y-2">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[--accent]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight text-[--text]">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-sm leading-relaxed text-[--text-muted]">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
