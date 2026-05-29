'use client';

import { Printer } from 'lucide-react';

/** Triggers the browser print dialog for the receipt sheet. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
    >
      <Printer size={14} /> طباعة
    </button>
  );
}
