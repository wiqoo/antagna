import Link from 'next/link';
import {
  ArrowLeft, Sparkles, Flame, ListChecks, ArrowUpRight,
  Camera, Users, Mail, Activity, Briefcase,
} from 'lucide-react';

export default function StudioDashboard() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08070D] text-white">
      {/* Animated mesh gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 15% 10%, rgba(255, 107, 26, 0.35), transparent 50%),
            radial-gradient(ellipse 60% 50% at 85% 25%, rgba(244, 63, 94, 0.25), transparent 50%),
            radial-gradient(ellipse 70% 60% at 50% 90%, rgba(168, 85, 247, 0.22), transparent 60%),
            radial-gradient(ellipse 50% 40% at 95% 80%, rgba(34, 211, 238, 0.15), transparent 50%)
          `,
        }}
      />

      {/* Grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto max-w-[1300px] px-6 py-10 md:px-10 md:py-14">
        <Link
          href="/preview/lab/v2"
          className="mb-8 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/50 hover:text-white"
        >
          <ArrowLeft size={12} className="rtl:rotate-180" />
          العودة
        </Link>

        {/* HERO — Bento with massive AI brief */}
        <div className="grid grid-cols-12 gap-3 md:gap-4">
          {/* Hero tile — AI brief, spans wide */}
          <article
            className="col-span-12 row-span-2 overflow-hidden rounded-3xl border border-white/10 p-7 md:col-span-8 md:p-10"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,107,26,0.18) 0%, rgba(244,63,94,0.12) 50%, rgba(168,85,247,0.08) 100%)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 backdrop-blur-md">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-orange-400"
                  style={{ boxShadow: '0 0 10px rgba(251,146,60,1)' }}
                />
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/85">
                  Antagna AI · Live
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                FRI · 22.05 · 16:42
              </span>
            </div>

            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-orange-300">
              مرحباً Mohammed
            </p>
            <h1
              className="text-[44px] font-bold leading-[0.95] tracking-[-0.025em] md:text-[60px]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              يوم{' '}
              <span
                className="bg-gradient-to-l from-orange-300 via-pink-400 to-purple-400 bg-clip-text text-transparent"
                style={{
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                ضغط على التسليم
              </span>
              <br />
              ٣ مشاريع، نقطة حرجة واحدة.
            </h1>

            <ol className="mt-7 space-y-3.5">
              {[
                {
                  num: '01',
                  text: 'Rolls Royce — تسليم ٣ أيام، إنجاز ٤٥٪. راجع الفريق قبل نهاية اليوم.',
                  urgent: true,
                },
                {
                  num: '02',
                  text: 'BMW thread — متأخر ٥٢س. الـ draft جاهز عند خالد.',
                },
                {
                  num: '03',
                  text: 'خالد على ٣ مشاريع. وزّع MG لـ فادي قبل الإثنين.',
                },
              ].map((b) => (
                <li key={b.num} className="flex gap-4">
                  <span
                    className={
                      'font-mono text-[12px] font-bold leading-[1.6] ' +
                      (b.urgent ? 'text-orange-300' : 'text-white/30')
                    }
                  >
                    {b.num}
                  </span>
                  <p className="flex-1 text-[15px] leading-[1.6] text-white/90 md:text-[16px]">
                    {b.text}
                  </p>
                </li>
              ))}
            </ol>

            <button
              className="mt-8 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-semibold text-black transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #FF8442 0%, #F472B6 100%)',
                boxShadow: '0 0 30px rgba(251,146,60,0.4)',
              }}
            >
              <Sparkles size={13} />
              جدّد التحليل
            </button>
          </article>

          {/* Big number — Revenue */}
          <article
            className="col-span-6 overflow-hidden rounded-3xl border border-white/10 p-6 md:col-span-4"
            style={{
              background:
                'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))',
              backdropFilter: 'blur(20px)',
            }}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
              إيراد الشهر
            </p>
            <p
              className="text-[58px] font-bold leading-[0.95] tracking-[-0.04em] text-white md:text-[72px]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              ٤١٠<span className="text-[28px] text-white/40">ك</span>
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">
              ↗ +١٨٪
            </div>
            {/* Sparkline */}
            <svg viewBox="0 0 100 30" className="mt-4 h-12 w-full">
              <defs>
                <linearGradient id="spark1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(52,211,153,0.5)" />
                  <stop offset="100%" stopColor="rgba(52,211,153,0)" />
                </linearGradient>
              </defs>
              <path
                d="M 0,22 L 12,18 L 24,20 L 36,15 L 48,16 L 60,10 L 72,12 L 84,7 L 100,4 L 100,30 L 0,30 Z"
                fill="url(#spark1)"
              />
              <path
                d="M 0,22 L 12,18 L 24,20 L 36,15 L 48,16 L 60,10 L 72,12 L 84,7 L 100,4"
                fill="none"
                stroke="rgb(52,211,153)"
                strokeWidth="1.5"
              />
            </svg>
          </article>

          {/* Mini stats row */}
          <MiniTile
            icon={Briefcase}
            label="مشاريع نشطة"
            value="١٢"
            tint="rgba(168,85,247,0.15)"
            iconColor="#C084FC"
            sparkline={[3, 4, 4, 5, 6, 8, 9, 11, 12]}
          />
          <MiniTile
            icon={ListChecks}
            label="مهام مفتوحة"
            value="٢٧"
            tint="rgba(34,211,238,0.15)"
            iconColor="#22D3EE"
            sparkline={[15, 18, 22, 20, 24, 23, 25, 27, 27]}
          />
          <MiniTile
            icon={Flame}
            label="Leads ساخنة"
            value="٤"
            tint="rgba(244,63,94,0.18)"
            iconColor="#FB7185"
            sparkline={[2, 2, 3, 3, 3, 4, 4, 4, 4]}
          />
          <MiniTile
            icon={Mail}
            label="ينتظر ردنا"
            value="٨"
            tint="rgba(251,191,36,0.18)"
            iconColor="#FBBF24"
            sparkline={[5, 6, 7, 7, 6, 8, 8, 8, 8]}
            urgent
          />

          {/* Capacity heatmap */}
          <article
            className="col-span-12 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:col-span-7"
            style={{ backdropFilter: 'blur(20px)' }}
          >
            <header className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
                  Capacity heatmap · ١٤ يوم
                </p>
                <h3
                  className="mt-1.5 text-[24px] font-bold tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  حمولة الفريق
                </h3>
              </div>
              <Link
                href="/team"
                className="flex items-center gap-1 text-[11px] text-orange-300 hover:text-orange-200"
              >
                التفاصيل
                <ArrowUpRight size={11} className="rtl:rotate-90" />
              </Link>
            </header>
            <Heatmap />
          </article>

          {/* Hot project */}
          <article
            className="col-span-12 overflow-hidden rounded-3xl border border-white/10 p-6 md:col-span-5"
            style={{
              background:
                'linear-gradient(135deg, rgba(244,63,94,0.18) 0%, rgba(168,85,247,0.10) 100%)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <header className="mb-4 flex items-center gap-2">
              <Flame size={14} className="text-pink-400" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-pink-200">
                النقطة الأحرّ
              </p>
            </header>
            <h3
              className="text-[26px] font-bold leading-[1.15] tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              رولز رويس<br />
              جولة الشوروم
            </h3>
            <p className="mt-3 text-[13px] text-white/65">
              تسليم بعد ٣ أيام · إنجاز ٤٥٪ · ٤ مهام معلقة
            </p>
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-[10px]">
                <span className="text-white/55">التقدم</span>
                <span className="font-mono text-pink-200">٤٥٪ من ١٠٠٪</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full"
                  style={{
                    width: '45%',
                    background: 'linear-gradient(90deg, #F472B6, #FB923C)',
                    boxShadow: '0 0 12px rgba(251,146,60,0.6)',
                  }}
                />
              </div>
            </div>
            <Link
              href="/projects"
              className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-pink-200 hover:text-pink-100"
            >
              افتح المشروع
              <ArrowUpRight size={12} className="rtl:rotate-90" />
            </Link>
          </article>

          {/* Activity stream */}
          <article
            className="col-span-12 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6"
            style={{ backdropFilter: 'blur(20px)' }}
          >
            <header className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
                  Live Activity
                </p>
                <h3
                  className="mt-1.5 text-[24px] font-bold tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  حركة Volt
                </h3>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-white/60">
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
                  style={{ boxShadow: '0 0 8px rgba(52,211,153,1)' }}
                />
                live
              </div>
            </header>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
              {[
                ['١٦:٣٨', 'خالد سلّم مونتاج BMW Summer', 'emerald'] as const,
                ['١٦:٢١', 'ريم وافقت على Reel 7', 'emerald'] as const,
                ['١٥:٥٨', 'إيميل مرسل لـ Lexus.SA', 'cyan'] as const,
                ['١٥:٣٤', 'مهمة جديدة من فادي', 'orange'] as const,
                ['١٤:٤٥', 'حجز كاميرا Canon R5', 'cyan'] as const,
                ['١٤:٢٢', 'AI لخّص ٧ threads', 'purple'] as const,
              ].map(([time, what, color]) => (
                <li
                  key={time + what}
                  className="flex items-baseline gap-3 border-b border-white/5 py-2.5 text-[12.5px]"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: `var(--tw-color, ${color === 'emerald' ? '#34D399' : color === 'cyan' ? '#22D3EE' : color === 'orange' ? '#FB923C' : '#C084FC'})`,
                      boxShadow: `0 0 8px ${color === 'emerald' ? '#34D399' : color === 'cyan' ? '#22D3EE' : color === 'orange' ? '#FB923C' : '#C084FC'}`,
                    }}
                  />
                  <span className="font-mono text-[10px] text-white/40">{time}</span>
                  <span className="flex-1 text-white/85">{what}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        {/* Cmd palette hint */}
        <div className="mt-10 flex items-center justify-center">
          <div
            className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 backdrop-blur-md"
            style={{ boxShadow: '0 0 40px rgba(0,0,0,0.5)' }}
          >
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
            <span className="text-[12px] text-white/60">
              للتنقل لأي صفحة أو تنفيذ أمر
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniTile({
  icon: Icon,
  label,
  value,
  tint,
  iconColor,
  sparkline,
  urgent,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  tint: string;
  iconColor: string;
  sparkline: number[];
  urgent?: boolean;
}) {
  const max = Math.max(...sparkline, 1);
  const min = Math.min(...sparkline);
  const range = max - min || 1;
  const path = sparkline
    .map((v, i) => {
      const x = (i / (sparkline.length - 1)) * 100;
      const y = 28 - ((v - min) / range) * 24;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <article
      className="col-span-6 overflow-hidden rounded-2xl border border-white/10 p-4 md:col-span-3"
      style={{
        background: tint,
        backdropFilter: 'blur(20px)',
      }}
    >
      <header className="mb-2 flex items-center justify-between">
        <Icon size={14} style={{ color: iconColor }} />
        {urgent && (
          <span className="text-[9px] uppercase tracking-wider text-yellow-300">
            ⚠
          </span>
        )}
      </header>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
        {label}
      </p>
      <p
        className="mt-1 text-[32px] font-bold leading-none tracking-[-0.025em]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value}
      </p>
      <svg viewBox="0 0 100 30" className="mt-2 h-7 w-full">
        <path d={path} fill="none" stroke={iconColor} strokeWidth="1.5" />
      </svg>
    </article>
  );
}

function Heatmap() {
  const PEOPLE = ['خالد', 'ريم', 'فادي', 'حمادة', 'آدم', 'حسين', 'كريم'];
  const seed = (i: number, j: number) => (i * 31 + j * 7) % 5;
  return (
    <div>
      <div className="grid grid-cols-[64px,1fr] gap-2">
        <div />
        <div className="mb-1 grid grid-cols-14 gap-1">
          {Array.from({ length: 14 }, (_, j) => (
            <span
              key={j}
              className={
                'text-center font-mono text-[9px] ' +
                (j === 0 ? 'text-orange-300' : 'text-white/35')
              }
            >
              {j === 0 ? 'اليوم' : j}
            </span>
          ))}
        </div>
        {PEOPLE.map((p, i) => (
          <Fragment key={p}>
            <span className="text-[11px] text-white/75">{p}</span>
            <div className="grid grid-cols-14 gap-1">
              {Array.from({ length: 14 }, (_, j) => {
                const v = seed(i, j);
                const color =
                  v === 0
                    ? 'rgba(255,255,255,0.04)'
                    : v < 2
                      ? 'rgba(52,211,153,0.45)'
                      : v < 4
                        ? 'rgba(251,191,36,0.55)'
                        : 'rgba(244,63,94,0.65)';
                return (
                  <div
                    key={j}
                    className="aspect-square rounded-sm"
                    style={{
                      background: color,
                      boxShadow:
                        v >= 4
                          ? '0 0 8px rgba(244,63,94,0.5)'
                          : v >= 2
                            ? '0 0 6px rgba(251,191,36,0.3)'
                            : 'none',
                    }}
                  />
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 text-[10px] text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: 'rgba(52,211,153,0.45)' }} />
          خفيف
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: 'rgba(251,191,36,0.55)' }} />
          متوسط
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: 'rgba(244,63,94,0.65)' }} />
          حمل زائد
        </span>
      </div>
    </div>
  );
}

import { Fragment } from 'react';
