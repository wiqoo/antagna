'use client';

import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { setInboundEmailEnabled } from '../actions';

export function InboundToggle({ enabled, canManage }: { enabled: boolean; canManage: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!canManage) return;
        start(() => setInboundEmailEnabled(!enabled));
      }}
      disabled={pending || !canManage}
      role="switch"
      aria-checked={enabled}
      className={
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ' +
        (enabled ? 'bg-[var(--success)]' : 'bg-[var(--surface-hover)]')
      }
    >
      <span
        className={
          'inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform ' +
          (enabled ? 'translate-x-1' : 'translate-x-6')
        }
      >
        {pending && <Loader2 size={11} className="animate-spin text-[var(--text-dim)]" />}
      </span>
    </button>
  );
}
