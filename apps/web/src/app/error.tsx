'use client';

import { useEffect } from 'react';
import { ErrorState } from '@antagna/ui';

/**
 * Global error boundary. Wraps every page render that throws.
 * Logs to console (Sentry already captures these in production via the
 * Next instrumentation hook).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[640px] px-4 py-12 md:px-8">
      <ErrorState
        title="حصلت مشكلة في تحميل الصفحة"
        description="حاول تحدّث الصفحة. لو المشكلة استمرت، الـ team هياخدوا إشعار تلقائي."
        detail={
          error.message + (error.digest ? `\n\ndigest: ${error.digest}` : '')
        }
        action={
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
          >
            حاول تاني
          </button>
        }
      />
    </div>
  );
}
