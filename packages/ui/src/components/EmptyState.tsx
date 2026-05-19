import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      {icon && (
        <div className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] text-[var(--text-dim)]">
          {icon}
        </div>
      )}
      <h3 className="text-[14px] font-medium text-[var(--text)]">{title}</h3>
      {description && (
        <p className="max-w-sm text-[12px] leading-relaxed text-[var(--text-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
