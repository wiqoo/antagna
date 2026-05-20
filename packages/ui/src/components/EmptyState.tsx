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
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {icon && (
        <div className="mb-1 text-[var(--text-dim)]">{icon}</div>
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
