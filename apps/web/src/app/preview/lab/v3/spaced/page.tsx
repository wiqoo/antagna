import Link from 'next/link';
import { ArrowLeft, Sparkles, ArrowUpRight } from 'lucide-react';

export default function SpacedDashboard() {
  return (
    <div className="min-h-screen bg-[#0F0F12] text-white">
      <div className="mx-auto max-w-[1240px] px-8 py-12 md:px-12 md:py-16">
        <Link
          href="/preview/lab/v3"
          className="mb-10 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/45 hover:text-white"
        >
          <ArrowLeft size={12} className="rtl:rotate-180" />
          العودة
        </Link>

        {/* Hero header */}
        <header className="mb-16 flex items-end justify-between border-b border-white/10 pb-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/40">
              Antagna · الجمعة ٢٢ مايو
            </p>
            <h1
              className="mt-3 text-[42px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[52px]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              مرحباً Mohammed
            </h1>
          </div>
          <button className="hidden items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-[11px] text-white/75 hover:border-[#FF6B1A] hover:text-[#FF6B1A] md:inline-flex">
            <Sparkles size={11} />
            جدّد التحليل
          </button>
        </header>

        {/* Brief — quiet */}
        <section className="mb-20">
          <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.32em] text-[#FF6B1A]">
            — AI Brief
          </p>
          <h2 className="max-w-3xl text-[26px] font-medium leading-[1.4] tracking-[-0.01em] text-white/90 md:text-[32px]">
            يوم ضغط على التسليم. رولز رويس متأخر، خالد فوق سقف الحمولة، إيميل BMW
            معلّق ٥٢ ساعة.
          </h2>
        </section>

        {/* HUGE numbers row */}
        <section className="mb-20 grid grid-cols-1 gap-12 border-t border-white/10 pt-12 md:grid-cols-3">
          <BigNumber label="إيراد الشهر" value="٤١٠" suffix="ك ر.س" delta="+١٨٪" />
          <BigNumber label="مشاريع نشطة" value="١٢" delta="٤ قريبة التسليم" accent />
          <BigNumber label="ينتظر ردنا" value="٨" suffix="إيميل" delta="٢ أقدم من ٧٢س" warning />
        </section>

        {/* Two-block layout */}
        <section className="mb-20 grid grid-cols-1 gap-12 border-t border-white/10 pt-12 md:grid-cols-[1.6fr_1fr]">
          {/* Project list — minimal */}
          <div>
            <header className="mb-6 flex items-baseline justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/40">
                  — أعلى الأولويات
                </p>
                <h3 className="mt-2 text-[24px] font-bold tracking-[-0.015em]" style={{ fontFamily: 'var(--font-display)' }}>
                  أربع مشاريع
                </h3>
              </div>
              <Link href="/projects" className="text-[11px] text-[#FF6B1A] hover:underline">
                الكل
              </Link>
            </header>

            <ul>
              {[
                ['رولز رويس — جولة الشوروم', 'إنجاز ٤٥٪', 'تسليم ٣ أيام', true],
                ['BMW Summer Campaign', 'إنجاز ٧٨٪', 'متأخر يوم', true],
                ['Rolls Royce — interior', 'إنجاز ٩٢٪', 'تسليم بكرة', false],
                ['لكزس LX social', 'إنجاز ١٢٪', '+١٤ يوم', false],
              ].map(([title, pct, due, urgent]) => (
                <li key={title as string}>
                  <Link
                    href="/projects"
                    className="grid grid-cols-[1fr_auto_auto_16px] items-baseline gap-6 border-b border-white/8 py-5 hover:bg-white/[0.015]"
                  >
                    <span className="text-[15px] text-white">{title as string}</span>
                    <span className="font-mono text-[12px] text-white/55">{pct as string}</span>
                    <span className={'text-[12px] ' + ((urgent as boolean) ? 'text-[#FF6B1A]' : 'text-white/55')}>
                      {due as string}
                    </span>
                    <ArrowUpRight size={13} className="text-white/30 rtl:rotate-90" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Capacity — ultra minimal */}
          <aside>
            <header className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/40">
                — حمولة الفريق
              </p>
              <h3 className="mt-2 text-[24px] font-bold tracking-[-0.015em]" style={{ fontFamily: 'var(--font-display)' }}>
                ١٤ يوم
              </h3>
            </header>

            <ul className="space-y-5">
              {[
                ['خالد', 4, 5, true],
                ['ريم', 3, 5, false],
                ['فادي', 2, 5, false],
                ['حمادة', 1, 5, false],
                ['آدم', 0, 5, false],
              ].map(([name, load, max, over]) => (
                <li key={name as string}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] text-white">{name as string}</span>
                    <span className="font-mono text-[12px] text-white/55">
                      <span className={(over as boolean) ? 'text-[#FF6B1A]' : ''}>{load as number}</span>
                      <span className="text-white/30"> / {max as number}</span>
                    </span>
                  </div>
                  <div className="mt-2 h-px bg-white/8">
                    <div
                      className={'h-full ' + ((over as boolean) ? 'bg-[#FF6B1A]' : 'bg-white/70')}
                      style={{ width: `${((load as number) / (max as number)) * 100}%`, height: 2, marginTop: -1 }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-8 text-[12px] leading-[1.65] text-white/60">
              خالد فوق السقف بـ ٢٠٪. وزّع MG لـ فادي قبل الإثنين.
            </p>
          </aside>
        </section>

        {/* Activity — sparse */}
        <section className="border-t border-white/10 pt-12">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-white/40">
            — حركة Volt
          </p>
          <h3 className="mb-8 text-[24px] font-bold tracking-[-0.015em]" style={{ fontFamily: 'var(--font-display)' }}>
            ست أحداث
          </h3>
          <ul className="space-y-0">
            {[
              ['١٦:٣٨', 'خالد سلّم مونتاج BMW Summer'],
              ['١٦:٢١', 'ريم وافقت على Reel 7'],
              ['١٥:٥٨', 'إيميل مرسل لـ Lexus.SA'],
              ['١٥:٣٤', 'مهمة جديدة من فادي'],
              ['١٤:٤٥', 'حجز كاميرا Canon R5 للأحد'],
              ['١٤:٢٢', 'AI لخّص ٧ threads'],
            ].map(([time, what]) => (
              <li key={(time as string) + (what as string)} className="grid grid-cols-[80px_1fr] gap-6 border-b border-white/8 py-4">
                <span className="font-mono text-[12px] text-white/40">{time as string}</span>
                <span className="text-[14px] text-white/85">{what as string}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-20 text-[10px] uppercase tracking-[0.32em] text-white/35">
          Antagna · Volt Production
        </footer>
      </div>
    </div>
  );
}

function BigNumber({
  label,
  value,
  suffix,
  delta,
  accent,
  warning,
}: {
  label: string;
  value: string;
  suffix?: string;
  delta: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/40">{label}</p>
      <div className="mt-4 flex items-baseline gap-3">
        <span
          className={
            'text-[88px] font-bold leading-[0.88] tracking-[-0.04em] ' +
            (accent ? 'text-[#FF6B1A]' : 'text-white')
          }
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {value}
        </span>
        {suffix && <span className="text-[14px] text-white/45">{suffix}</span>}
      </div>
      <p className={'mt-3 text-[12px] ' + (warning ? 'text-[#FF6B1A]' : 'text-white/55')}>
        {delta}
      </p>
    </div>
  );
}
