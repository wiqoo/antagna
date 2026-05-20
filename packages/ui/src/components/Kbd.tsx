import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-[var(--line-strong)] bg-[var(--bg-elevated)] px-1.5 font-mono text-[10px] font-medium text-[var(--text-muted)]">
      {children}
    </kbd>
  );
}
