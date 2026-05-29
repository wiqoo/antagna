'use client';

import { useTransition } from 'react';
import { Loader2, ShieldOff } from 'lucide-react';
import { revokeToken } from '../actions';

export function RevokeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm('إبطال هذا التوكن؟ التكاملات اللي بتستخدمه هتتوقف.')) return;
        start(() => revokeToken(id));
      }}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:border-[var(--danger)]/50 hover:text-[var(--danger)] disabled:opacity-50"
    >
      {pending ? <Loader2 size={11} className="animate-spin" /> : <ShieldOff size={11} />}
      إبطال
    </button>
  );
}
