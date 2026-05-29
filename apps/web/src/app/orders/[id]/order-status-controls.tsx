'use client';

import { useTransition } from 'react';
import { setPurchaseOrderStatus } from '../actions';

const STEPS: { value: string; label: string }[] = [
  { value: 'draft', label: 'مسودّة' },
  { value: 'sent', label: 'مُرسَل' },
  { value: 'received', label: 'مُستلَم' },
  { value: 'cancelled', label: 'ملغى' },
];

/**
 * Inline status switcher for a PO. Calls the server action and lets Next revalidate
 * the page; the active step is highlighted by the server-passed `current`.
 */
export function OrderStatusControls({ orderId, current }: { orderId: string; current: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {STEPS.map((s) => {
        const active = s.value === current;
        return (
          <button
            key={s.value}
            type="button"
            disabled={pending || active}
            onClick={() =>
              startTransition(() => {
                void setPurchaseOrderStatus(orderId, s.value);
              })
            }
            className={
              'h-8 rounded-md border px-3 text-[12px] font-medium transition-colors disabled:cursor-default ' +
              (active
                ? 'border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--text)]'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-50')
            }
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
