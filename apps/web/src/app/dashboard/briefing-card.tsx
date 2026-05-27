'use client';

import { useMemo, useState, useTransition } from 'react';
import { Sparkles, Loader2, RotateCw } from 'lucide-react';
import { AIHints, type AIHint } from '@antagna/ui';
import { generateBriefing, type Briefing } from './briefing-actions';

const MOOD_LABEL: Record<string, string> = {
  calm: 'يوم هادئ',
  busy: 'يوم مشغول',
  critical: 'يوم حرج',
};

export function BriefingCard({
  initial,
  greeting,
  dateStr,
  firstName,
}: {
  initial: Briefing | null;
  greeting: string;
  dateStr: string;
  firstName: string;
}) {
  const [briefing, setBriefing] = useState<Briefing | null>(initial);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  function handleRefresh() {
    setErr(null);
    setDismissed(new Set());
    startTransition(async () => {
      const res = await generateBriefing();
      if (res.ok) {
        setBriefing(res.briefing);
      } else {
        setErr(res.error);
      }
    });
  }

  function dismissOne(i: number) {
    setDismissed((s) => {
      const next = new Set(s);
      next.add(i);
      return next;
    });
  }

  if (!briefing) {
    return (
      <section className="ai-strip p-5 md:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded bg-[var(--accent-tint)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]">
            <Sparkles size={10} strokeWidth={2} />
            Antagna AI
          </span>
          <span className="text-[10px] text-[var(--text-dim)]">
            {greeting}، {firstName} · {dateStr}
          </span>
        </div>
        <h2
          className="text-[22px] font-bold leading-[1.2] tracking-[-0.018em] md:text-[28px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span className="gradient-text">ابدأ يومك بملخص ذكي</span>
        </h2>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-[var(--text-muted)]">
          يقرأ كل ما حدث في Volt من إيميلات ومشاريع ومهام، ويرتّب لك ٣–٥ نقاط
          تحتاج قراراً منك الآن.
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
            {isPending ? 'بيجهّز…' : 'لخّص يومي'}
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
        ? `محدّث من ${ageMin}د`
        : `من ${Math.floor(ageMin / 60)}س`;

  const visibleBullets = useMemo(
    () =>
      briefing.bullets
        .map((b, i) => ({ b, i }))
        .filter(({ i }) => !dismissed.has(i)),
    [briefing.bullets, dismissed],
  );

  const hints: AIHint[] = visibleBullets.map(({ b, i }, displayIdx) => ({
    index: String(displayIdx + 1).padStart(2, '0'),
    text: b.text,
    insight: b.action,
    urgent: b.priority === 'high',
    actions: b.link
      ? [
          { label: 'افتح', href: b.link, primary: true },
          { label: 'أجّل', onClick: () => dismissOne(i) },
        ]
      : [{ label: 'تم', onClick: () => dismissOne(i) }],
  }));

  const mood = MOOD_LABEL[briefing.mood] ?? 'يوم عادي';
  const remaining = visibleBullets.length;
  const total = briefing.bullets.length;
  const allDismissed = remaining === 0;

  return (
    <div className="relative">
      <AIHints
        context={`Antagna AI · ${mood}`}
        headline={
          <>
            <span className="block text-[11px] font-medium text-[var(--text-muted)] tracking-normal normal-case mb-1.5" style={{ fontFamily: 'var(--font-sans)' }}>
              {greeting}، {firstName}
            </span>
            <span className="gradient-text">{briefing.headline}</span>
          </>
        }
        summary={
          allDismissed
            ? 'انتهت كل النقاط — اضغط 🔄 إذا أردت ملخصاً جديداً.'
            : `${remaining} من ${total} نقطة تحتاج قراراً${remaining < total ? ` · أجّلت ${total - remaining}` : ''}`
        }
        hints={hints}
        updatedAt={updatedAt}
      />
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isPending}
        title="ولّد ملخص جديد"
        className="absolute end-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-2.5 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <RotateCw size={11} />
        )}
        {isPending ? 'بيجهّز' : 'جدّد'}
      </button>
      {err && (
        <p className="mt-2 text-[12px] text-[var(--danger)]">⚠ {err}</p>
      )}
    </div>
  );
}
