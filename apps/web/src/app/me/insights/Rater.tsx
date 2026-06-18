'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { selfRateArea } from '../actions6';

export function Rater({ areaId, name, icon, color, self, activity }: {
  areaId: string; name: string; icon: string; color: string; self: number | null; activity: number;
}) {
  const router = useRouter();
  const [val, setVal] = useState(self);
  const [pending, start] = useTransition();

  function rate(score: number) {
    setVal(score);
    start(async () => { await selfRateArea(areaId, score); router.refresh(); });
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px]">{icon} {name}</span>
        <span className="text-[10.5px] text-[var(--text-dim)]">{val != null ? `${val}/10` : 'قيّم'}{activity > 0 ? ` · ${activity} نشاط` : ''}</span>
      </div>
      <div className="flex gap-1" style={{ opacity: pending ? 0.5 : 1 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
          <button key={s} onClick={() => rate(s)} aria-label={`${s}`}
            className="h-5 flex-1 rounded-sm transition-all"
            style={{ background: val != null && s <= val ? color : 'var(--surface-hover)' }} />
        ))}
      </div>
    </div>
  );
}
