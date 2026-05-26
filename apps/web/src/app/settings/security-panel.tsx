'use client';

import { useRef, useState, useTransition } from 'react';
import { KeyRound, Check } from 'lucide-react';
import { changePassword } from './actions';

const input =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2.5 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]';

export function SecurityPanel() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await changePassword(fd);
      if (res.ok) {
        setMsg({ ok: true, text: 'تم تحديث كلمة المرور.' });
        formRef.current?.reset();
      } else {
        setMsg({ ok: false, text: res.error ?? 'تعذّر التحديث' });
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-[var(--text)]">
            كلمة المرور الجديدة
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            dir="ltr"
            className={input}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-[var(--text)]">
            تأكيد كلمة المرور
          </span>
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            dir="ltr"
            className={input}
          />
        </label>
      </div>

      {msg && (
        <p
          className={
            'rounded-lg border px-3 py-2 text-[13px] ' +
            (msg.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300')
          }
        >
          {msg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <KeyRound size={14} /> {pending ? 'يحدّث…' : 'تحديث كلمة المرور'}
      </button>
    </form>
  );
}
