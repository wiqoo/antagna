'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { AIHints, type AIHint } from '@antagna/ui';
import { generateBriefing, type Briefing } from './briefing-actions';

const MOOD_LABEL: Record<string, string> = {
  calm: 'هادئ',
  busy: 'مشغول',
  critical: 'حرج',
};

export function BriefingCard({
  initial,
  greeting,
  dateStr,
}: {
  initial: Briefing | null;
  greeting: string;
  dateStr: string;
}) {
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
      <section className="ai-strip p-5 md:p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded bg-[var(--accent-tint)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]">
            <Sparkles size={10} strokeWidth={2} />
            Antagna AI
          </span>
          <span className="text-[10px] text-[var(--text-dim)]">{dateStr}</span>
        </div>
        <h2
          className="text-[24px] font-bold leading-[1.2] tracking-[-0.018em] md:text-[30px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {greeting} محمد —{' '}
          <span className="gradient-text">جاهز يلخّص يومك؟</span>
        </h2>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-[var(--text-muted)]">
          Claude ممكن يقرأ كل أنشطة Volt ويقترح أولوياتك في ثوانٍ. أنت تقرر،
          هو ينبّه ويقترح.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className="magnet inline-flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--accent-gradient)' }}
          >
            {isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {isPending ? 'يجهّز…' : 'لخّص يومي'}
          </button>
        </div>
        {err && (
          <p className="mt-3 text-[12px] text-[var(--danger)]">⚠ {err}</p>
        )}
      </section>
    );
  }

  const ageMin = Math.floor(
    (Date.now() - new Date(briefing.generated_at).getTime()) / 60_000,
  );
  const updatedAt =
    ageMin < 1
      ? 'محدّث الآن'
      : ageMin < 60
        ? `محدّث منذ ${ageMin}د`
        : `محدّث منذ ${Math.floor(ageMin / 60)}س`;

  const hints: AIHint[] = briefing.bullets.map((b, i) => ({
    index: String(i + 1).padStart(2, '0'),
    text: b.text,
    insight: b.action,
    urgent: b.priority === 'high',
    actions: b.link
      ? [
          {
            label: 'افتح',
            href: b.link,
            primary: true,
          },
          { label: 'لاحقاً', onClick: () => undefined },
        ]
      : [{ label: 'تمام', onClick: () => undefined }],
  }));

  const mood = MOOD_LABEL[briefing.mood] ?? 'مشغول';

  return (
    <div className="relative">
      <AIHints
        context={`Antagna AI · ${mood}`}
        headline={
          <>
            {greeting} محمد — <span className="gradient-text">{briefing.headline}</span>
          </>
        }
        summary={`Claude راجع كل أنشطة Volt. أنت من يقرر، وهو ينبّه.`}
        hints={hints}
        updatedAt={updatedAt}
      />
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isPending}
        title="حلّل من جديد"
        className="absolute end-4 top-4 grid h-8 w-8 place-items-center rounded-md border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Sparkles size={13} />
        )}
      </button>
      {err && (
        <p className="mt-2 text-[12px] text-[var(--danger)]">⚠ {err}</p>
      )}
    </div>
  );
}
