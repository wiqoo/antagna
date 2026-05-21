import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Inline error block — for "this section failed" within an otherwise
 * working page. For page-level failures, use a Next.js error.tsx instead.
 */
export function ErrorState({
  title = 'حصلت مشكلة',
  description,
  action,
  detail,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/[0.04] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 text-[var(--danger)]" />
        <div className="flex-1 space-y-1">
          <p className="text-[13px] font-semibold text-[var(--text)]">{title}</p>
          {description && (
            <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
              {description}
            </p>
          )}
          {detail && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] text-[var(--text-dim)]">
                التفاصيل التقنية
              </summary>
              <pre className="mt-1 overflow-x-auto rounded border border-[var(--line)] bg-black/30 p-2 text-[10px] text-[var(--text-muted)]">
                {detail}
              </pre>
            </details>
          )}
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}
