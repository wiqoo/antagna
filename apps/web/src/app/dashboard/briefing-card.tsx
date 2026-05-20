'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Loader2, ArrowUpRight } from 'lucide-react';
import { generateBriefing, type Briefing } from './briefing-actions';

const MOOD_TONE: Record<string, { label: string; cls: string }> = {
  calm:    { label: 'هادئ',   cls: 'text-[var(--success)]' },
  busy:    { label: 'مشغول',  cls: 'text-[var(--warning)]' },
  critical:{ label: 'حرج',    cls: 'text-[var(--danger)]'  },
};

const PRI_DOT: Record<string, string> = {
  high:   'bg-[var(--danger)]',
  medium: 'bg-[var(--warning)]',
  low:    'bg-[var(--text-dim)]',
};

export function BriefingCard({ initial }: { initial: Briefing | null }) {
  const [briefing, setBriefing] = useState<Briefing | null>(initial);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function handleRefresh() {
    setErr(null);
    startTransition(async () => {
      const res = await generateBriefing();
      if (res.ok) {
        setBriefing(res.briefing);
      } else {
        setErr(res.error);
      }
    });
  }

  if (!briefing) {
    return (
      <div className="rounded-lg border border-[var(--accent)]/25 bg-gradient-to-l from-[var(--accent)]/[0.06] to-transparent p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              — Antagna AI · Daily Briefing
            </p>
            <p className="mt-2 text-[14px] text-[var(--text)]">
              لا يوجد ملخص بعد. Claude ممكن يلخّص لك يوم Volt في ثوانٍ.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className="magnet inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[13px] font-semibold text-black hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isPending ? 'يجهّز…' : 'لخّص يومي'}
          </button>
        </div>
        {err && <p className="mt-3 text-[12px] text-[var(--danger)]">⚠ {err}</p>}
      </div>
    );
  }

  const mood = MOOD_TONE[briefing.mood] ?? MOOD_TONE.busy!;
  const ageMin = Math.floor(
    (Date.now() - new Date(briefing.generated_at).getTime()) / 60_000,
  );

  return (
    <div className="rounded-lg border border-[var(--accent)]/25 bg-gradient-to-l from-[var(--accent)]/[0.06] to-transparent p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              — Antagna AI
            </p>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${mood.cls}`}>
              · {mood.label}
            </span>
            <span className="font-mono text-[10px] text-[var(--text-dim)]">
              · منذ {ageMin < 1 ? 'الآن' : `${ageMin}د`}
            </span>
          </div>
          <h2 className="mt-3 text-[20px] font-bold tracking-tight text-[var(--text)]">
            {briefing.headline}
          </h2>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isPending}
          title="حلّل من جديد"
          className="grid h-8 w-8 place-items-center rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        </button>
      </div>

      <ul className="mt-5 space-y-2.5">
        {briefing.bullets.map((b, i) => (
          <li
            key={i}
            className="grid grid-cols-[auto,1fr,auto] items-start gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 px-3 py-2.5"
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${PRI_DOT[b.priority] ?? PRI_DOT.medium}`}
            />
            <div className="min-w-0">
              <p className="text-[13px] text-[var(--text)]">{b.text}</p>
              {b.action && (
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  ↳ <span className="text-[var(--text)]">{b.action}</span>
                </p>
              )}
            </div>
            {b.link && (
              <a
                href={b.link}
                className="inline-flex h-6 w-6 items-center justify-center text-[var(--text-dim)] hover:text-[var(--accent)]"
              >
                <ArrowUpRight size={12} className="rtl:rotate-180" />
              </a>
            )}
          </li>
        ))}
      </ul>

      {err && <p className="mt-3 text-[12px] text-[var(--danger)]">⚠ {err}</p>}
    </div>
  );
}
