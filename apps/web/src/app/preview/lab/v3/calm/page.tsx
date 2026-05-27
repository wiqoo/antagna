import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function CalmDashboard() {
  return (
    <div className="min-h-screen bg-[#0F0F12] text-white">
      <div className="mx-auto max-w-[1240px] px-8 py-10 md:px-12 md:py-14">
        <Link
          href="/preview/lab/v3"
          className="mb-8 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/45 hover:text-white"
        >
          <ArrowLeft size={12} className="rtl:rotate-180" />
          العودة
        </Link>

        {/* Top meta line */}
        <div className="mb-10 flex items-baseline justify-between border-b border-white/8 pb-4">
          <div className="flex items-baseline gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Antagna
            </span>
            <span className="text-[10px] text-white/30">·</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">
              الجمعة ٢٢ مايو ٢٠٢٦
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">
            ١٦:٤٢
          </span>
        </div>

        {/* Hero */}
        <section className="mb-16">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.32em] text-[#FF6B1A]">
            — AI Brief
          </p>
          <h1
            className="text-[44px] font-bold leading-[1.05] tracking-[-0.025em] md:text-[64px]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            مرحباً Mohammed<span className="text-white/30">.</span>
          </h1>
          <h2
            className="mt-2 text-[28px] font-medium leading-[1.2] tracking-[-0.015em] text-white/85 md:text-[36px]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            يوم ضغط على التسليم<span className="text-[#FF6B1A]">.</span> رولز رويس متأخر،<br />
            خالد فوق سقف الحمولة.
          </h2>

          <ol className="mt-10 max-w-3xl space-y-5">
            {[
              ['01', 'رولز رويس: التسليم خلال ٣ أيام، الإنجاز ٤٥٪. راجع الفريق قبل نهاية اليوم.', true],
              ['02', 'إيميل BMW متأخر ٥٢ ساعة. الـ draft جاهز عند خالد.', false],
              ['03', 'خالد على ٣ مشاريع متزامنة. وزّع MG لـ فادي قبل الإثنين.', false],
            ].map(([num, text, urgent]) => (
              <li key={num as string} className="grid grid-cols-[40px_1fr] gap-4 border-b border-white/8 pb-5">
                <span className={'font-mono text-[14px] font-bold ' + ((urgent as boolean) ? 'text-[#FF6B1A]' : 'text-white/35')}>
                  {num as string}
                </span>
                <p className="text-[16px] leading-[1.65] text-white/90">{text as string}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex items-center gap-4">
            <button className="inline-flex items-center gap-2 rounded-md border border-[#FF6B1A] bg-[#FF6B1A] px-4 py-2 text-[12px] font-semibold text-black hover:bg-[#FF8442]">
              <Sparkles size={12} />
              جدّد التحليل
            </button>
            <span className="text-[11px] text-white/40">محدّث منذ ٤ دقايق</span>
          </div>
        </section>

        {/* Three metrics — restrained */}
        <section className="mb-16 grid grid-cols-1 gap-10 border-t border-white/8 pt-10 md:grid-cols-3">
          <Metric label="إيراد الشهر" value="٤١٠" unit="ألف ر.س" delta="+١٨٪ من الشهر الماضي" />
          <Metric label="مشاريع نشطة" value="١٢" unit="مشروع" delta="٤ منها قريبة التسليم" />
          <Metric label="ينتظر ردنا" value="٨" unit="إيميل" delta="٢ أقدم من ٧٢ ساعة" warning />
        </section>

        {/* Two-column layout */}
        <section className="grid grid-cols-1 gap-12 border-t border-white/8 pt-10 md:grid-cols-[2fr_1fr]">
          <article>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-white/45">
              — اليوم وهذا الأسبوع
            </p>
            <h3 className="mb-6 text-[28px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
              أربع لقطات قادمة
            </h3>
            <ul className="space-y-0">
              {[
                ['٢١:٣٣', 'اليوم', 'جولة الشوروم — MG', 'إم تي إن للسيارات', 'الرياض', true],
                ['٠٩:٠٠', 'غداً', 'BMW Summer Campaign', 'BMW السعودية', 'جدة', false],
                ['١٠:٠٠', 'الأحد', 'Rolls Royce — interior', 'رولز رويس', 'الرياض', false],
                ['٠٧:٣٠', 'الإثنين', 'لكزس LX social', 'لكزس', 'جدة', false],
              ].map(([time, day, title, client, city, isToday]) => (
                <li key={(time as string) + (title as string)} className="grid grid-cols-[64px_80px_1fr_auto] items-baseline gap-4 border-b border-white/8 py-4">
                  <span className={'font-mono text-[14px] ' + ((isToday as boolean) ? 'text-[#FF6B1A]' : 'text-white/85')}>
                    {time as string}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {day as string}
                  </span>
                  <div>
                    <p className="text-[14px] text-white">{title as string}</p>
                    <p className="mt-0.5 text-[11px] text-white/55">
                      {client as string} · {city as string}
                    </p>
                  </div>
                  {(isToday as boolean) && (
                    <span className="h-2 w-2 rounded-full bg-[#FF6B1A]" />
                  )}
                </li>
              ))}
            </ul>
          </article>

          <aside>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-white/45">
              — حمولة الفريق
            </p>
            <h3 className="mb-6 text-[22px] font-bold tracking-[-0.015em]" style={{ fontFamily: 'var(--font-display)' }}>
              ١٤ يوم
            </h3>
            <ul className="space-y-3">
              {[
                ['خالد', 4, 5, true],
                ['ريم', 3, 5, false],
                ['فادي', 2, 5, false],
                ['حمادة', 1, 5, false],
                ['آدم', 0, 5, false],
              ].map(([name, load, max, over]) => (
                <li key={name as string} className="flex items-center gap-3 text-[12px]">
                  <span className="w-14 text-white/80">{name as string}</span>
                  <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                    <div
                      className={'h-full ' + ((over as boolean) ? 'bg-[#FF6B1A]' : 'bg-white/70')}
                      style={{ width: `${((load as number) / (max as number)) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-white/55">{load as number}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[12px] leading-relaxed text-white/60">
              خالد فوق السقف بـ ٢٠٪. وزّع MG لـ فادي قبل الإثنين.
            </p>
          </aside>
        </section>

        {/* Activity */}
        <section className="mt-16 border-t border-white/8 pt-10">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-white/45">
            — أنشطة اليوم
          </p>
          <h3 className="mb-6 text-[28px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            حركة Volt
          </h3>
          <ul className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
            {[
              ['١٦:٣٨', 'خالد سلّم مونتاج BMW Summer'],
              ['١٦:٢١', 'ريم وافقت على Reel 7'],
              ['١٥:٥٨', 'إيميل مرسل لـ Lexus.SA'],
              ['١٥:٣٤', 'مهمة جديدة من فادي'],
              ['١٤:٤٥', 'حجز كاميرا Canon R5 للأحد'],
              ['١٤:٢٢', 'AI لخّص ٧ threads'],
            ].map(([time, what]) => (
              <li key={(time as string) + (what as string)} className="flex items-baseline gap-4 border-b border-white/8 py-3 text-[13px]">
                <span className="font-mono text-[11px] text-white/40">{time as string}</span>
                <span className="flex-1 text-white/85">{what as string}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-20 border-t border-white/8 pt-6 text-center">
          <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">
            VOLT PRODUCTION · MMXXVI
          </p>
        </footer>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  delta,
  warning,
}: {
  label: string;
  value: string;
  unit: string;
  delta: string;
  warning?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/45">{label}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className="text-[58px] font-bold leading-none tracking-[-0.04em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {value}
        </span>
        <span className="text-[13px] text-white/45">{unit}</span>
      </div>
      <p className={'mt-3 text-[12px] ' + (warning ? 'text-[#FF6B1A]' : 'text-white/55')}>
        {delta}
      </p>
    </div>
  );
}
