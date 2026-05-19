import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 font-mono text-[10px] font-semibold uppercase text-[var(--text-muted)] shadow-[inset_0_-1px_0_rgba(0,0,0,0.5)]">
      {children}
    </kbd>
  );
}
