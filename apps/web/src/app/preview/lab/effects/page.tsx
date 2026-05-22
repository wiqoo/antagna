'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';

export default function EffectsLab() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-8 md:py-14">
        <Link
          href="/preview/lab"
          className="mb-6 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={13} className="rtl:rotate-180" />
          العودة
        </Link>
        <header className="mb-10 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            القسم ٤ — التأثيرات
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            hover / focus / motion
          </h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
            مرّ بالماوس على كل كرت لتشوف التأثير. الـ research من Linear بيقول: تأثيرات subtle
            (translate ≤ 2px، opacity changes) أحسن من التأثيرات القوية في ops UIs — لأنها
            بتشتغل ١٠٠+ مرة في اليوم.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <EffectCard
            tag="١ — Magnet (الحالي)"
            desc="ترانسفورم لأعلى ٢-٣px + shadow. عاجب الناس بس بياخد attention."
            className="magnet-current"
          />
          <EffectCard
            tag="٢ — Subtle lift (موصى به)"
            recommended
            desc="translateY(-1px) فقط + border يلمع. الأسلم لـ ops UI."
            className="subtle-lift"
          />
          <EffectCard
            tag="٣ — Border glow"
            desc="ما يتحركش الكرت، لكن البوردر يتلوّن بـ accent. Linear-style."
            className="border-glow"
          />
          <EffectCard
            tag="٤ — Background shift"
            desc="الخلفية بس تتغيّر — مفيش transform خالص. Cron Calendar pattern."
            className="bg-shift"
          />
          <EffectCard
            tag="٥ — Scale + glow"
            desc="scale(1.02) + accent shadow. ممتاز للـ hero cards، مبالغ فيه للقوائم."
            className="scale-glow"
          />
          <EffectCard
            tag="٦ — None (Static)"
            desc="مفيش hover خالص، cursor pointer وكفى. أسرع، أكثر professional."
            className="static-card"
          />
        </div>

        <h2 className="mt-12 mb-3 text-[18px] font-semibold">دخول العناصر (page-load)</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <LoadCard tag="١ — Fade-in" className="fade-in-card">
            تدريجي ٢٠٠ms. كل العناصر بنفس الوقت.
          </LoadCard>
          <LoadCard tag="٢ — Stagger (موصى به)" recommended className="stagger-card">
            تدريجي مع تأخير ٥٠ms لكل عنصر. ينعش بدون إزعاج.
          </LoadCard>
          <LoadCard tag="٣ — Slide up" className="slide-up-card">
            من أسفل ٨px + fade. أكثر "حركة".
          </LoadCard>
        </div>

        <div className="mt-12 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-tint)] p-5">
          <p className="text-[12px] text-[var(--text)]">
            قولي رقم للـ hover ورقم للـ load (مثال: "hover ٢، load stagger") وأطبّق.
          </p>
        </div>
      </div>

      <style>{`
        .magnet-current { transition: transform .15s ease, box-shadow .15s ease; }
        .magnet-current:hover { transform: translateY(-3px); box-shadow: 0 12px 30px -8px rgba(0,0,0,0.5); }

        .subtle-lift { transition: transform .12s ease, border-color .12s ease; }
        .subtle-lift:hover { transform: translateY(-1px); border-color: var(--accent) !important; }

        .border-glow { transition: border-color .15s ease, box-shadow .15s ease; }
        .border-glow:hover { border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-tint); }

        .bg-shift { transition: background .15s ease; }
        .bg-shift:hover { background: var(--bg-elevated) !important; }

        .scale-glow { transition: transform .2s ease, box-shadow .2s ease; }
        .scale-glow:hover { transform: scale(1.02); box-shadow: 0 0 40px -10px var(--accent); }

        .static-card { cursor: pointer; }

        .fade-in-card { animation: fadeIn .25s ease both; }
        .stagger-card { animation: fadeIn .25s ease both; animation-delay: .1s; }
        .slide-up-card { animation: slideUp .3s ease both; }

        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}

function EffectCard({
  tag,
  desc,
  recommended,
  className,
}: {
  tag: string;
  desc: string;
  recommended?: boolean;
  className: string;
}) {
  return (
    <div
      className={
        'cursor-pointer rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 ' +
        className
      }
    >
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          {tag}
        </p>
        {recommended && (
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
            <CheckCircle2 size={10} />
          </span>
        )}
      </div>
      <p className="mb-3 text-[12px] text-[var(--text-muted)]">{desc}</p>
      <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
        <Sparkles size={11} />
        مرّ بالماوس
      </div>
    </div>
  );
}

function LoadCard({
  tag,
  children,
  recommended,
  className,
}: {
  tag: string;
  children: React.ReactNode;
  recommended?: boolean;
  className: string;
}) {
  return (
    <div className={'rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 ' + className}>
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          {tag}
        </p>
        {recommended && (
          <span className="rounded-md bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
            ✓
          </span>
        )}
      </div>
      <p className="text-[12px] text-[var(--text-muted)]">{children}</p>
    </div>
  );
}
