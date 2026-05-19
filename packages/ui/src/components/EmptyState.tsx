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
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[--surface-hover] text-[--text-muted]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-[--text]">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-[--text-muted]">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
