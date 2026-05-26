import Link from 'next/link';
import {
  ArrowLeft, ArrowUpRight, Sparkles, Camera, TrendingUp,
  Mail, Users, Activity, Calendar as CalendarIcon,
} from 'lucide-react';

export default function EditorialDashboard() {
  return (
    <div className="relative min-h-screen bg-[#FAF8F4] text-[#0A0A0D]">
      {/* Subtle paper texture via gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            radial-gradient(circle at 15% 20%, rgba(251, 191, 36, 0.06), transparent 40%),
            radial-gradient(circle at 85% 80%, rgba(0, 0, 0, 0.03), transparent 40%)
          `,
        }}
      />

      <div className="relative mx-auto max-w-[1280px] px-8 py-10 md:px-12 md:py-14">
        {/* Back link */}
        <Link
          href="/preview/lab/v2"
          className="mb-8 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-black/50 hover:text-black"
        >
          <ArrowLeft size={12} className="rtl:rotate-180" />
          العودة
        </Link>

        {/* Magazine masthead */}
        <header className="mb-12 flex items-end justify-between border-b border-black/15 pb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-black/40">
              Antagna · العدد ٤٢ · الجمعة ٢٢ مايو ٢٠٢٦
            </p>
            <h1
              className="mt-2 text-[88px] font-bold leading-[0.85] tracking-[-0.04em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              يومك<span className="text-black/30">.</span>
            </h1>
          </div>
          <div className="hidden text-end md:block">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/40">
              مرحباً
            </p>
            <p className="mt-1 text-[20px] font-semibold tracking-[-0.01em]">Mohammed</p>
          </div>
        </header>

        {/* Hero — AI brief as an opening article */}
        <section className="mb-14 grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr]">
          <article>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-amber-700">
              — افتتاحية AI
            </p>
            <h2
              className="text-[42px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[52px]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              يوم<span className="text-amber-600"> ضغط</span> على<br />
              التسليم — جولة<br />
              الشوروم في خطر.
            </h2>
            <p className="mt-6 max-w-xl text-[16px] leading-[1.7] text-black/75">
              مشروع رولز رويس على بعد ٣ أيام من التسليم، نسبة الإنجاز ٤٥٪ فقط — راجع
              الفريق قبل نهاية اليوم. خالد لسه ما رد على رسالة BMW منذ ٥٢ ساعة، والكاميرا
              الـ Canon R5 بطاريتها تحت ٢٠٪.
            </p>
            <div className="mt-7 flex items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-[12px] font-semibold text-white hover:bg-black/85">
                <Sparkles size={13} />
                اقرأ التحليل كامل
              </button>
              <span className="text-[11px] text-black/40">٣ دقايق قراءة · ٤ بنود</span>
            </div>
          </article>

          {/* Pull quote */}
          <aside className="border-s-2 border-amber-500 ps-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-black/40">
              النبرة اليوم
            </p>
            <p
              className="mt-3 text-[26px] font-medium leading-[1.3] tracking-[-0.015em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              "ركّز على التسليم، أجّل البريفات الجديدة لبكرة."
            </p>
            <div className="mt-5 flex items-center gap-2 text-[11px] text-black/55">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              يوم مشغول · ٤ نقاط حرجة
            </div>
          </aside>
        </section>

        {/* Three feature columns */}
        <section className="mb-14 grid grid-cols-1 gap-10 md:grid-cols-3">
          <Feature
            label="إيراد الشهر"
            value="٤١٠"
            unit="ألف ر.س"
            delta="+١٨٪ من الشهر الماضي"
            deltaUp
          />
          <Feature
            label="مشاريع نشطة"
            value="١٢"
            unit="مشروع"
            delta="٤ منها قريبة التسليم"
          />
          <Feature
            label="ينتظر ردنا"
            value="٨"
            unit="إيميل"
            delta="٢ منها أقدم من ٧٢ ساعة"
            warning
          />
        </section>

        {/* Editorial section grid */}
        <section className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-12">
          {/* Big feature */}
          <article className="md:col-span-7">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-black/40">
              — مقال رئيسي · الإنتاج
            </p>
            <h3
              className="mb-4 text-[30px] font-bold leading-[1.15] tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              أربعة مشاريع تتنافس على نفس الفريق هذا الأسبوع
            </h3>
            <p className="mb-5 text-[14px] leading-[1.75] text-black/70">
              خالد على ٣ مشاريع متزامنة، ريم على اثنين، الباقي موزّع. الأسبوع القادم
              يحتاج إعادة توزيع — يا تجيب dronev آخر، يا تأجّل LX لشهر يونيو.
            </p>
            <ul className="space-y-3 border-t border-black/10 pt-4">
              {[
                ['BMW Summer 2026', 'مونتاج', 'متأخر يوم', 'خالد، ريم'],
                ['حملة Rolls Royce', 'مراجعة', 'بكرة', 'ريم'],
                ['جولة الشوروم MG', 'تصوير', 'بعد ٢ أيام', 'خالد'],
                ['لكزس LX Social', 'بريف', '+١٤ يوم', 'فادي'],
              ].map(([title, stage, due, who]) => (
                <li key={title} className="flex items-baseline gap-4 text-[13px]">
                  <span className="flex-1 font-medium text-black">{title}</span>
                  <span className="text-black/45">{stage}</span>
                  <span className="text-black/45">{due}</span>
                  <span className="text-black/45">{who}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* Sidebar — capacity */}
          <aside className="md:col-span-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-black/40">
              — قراءة سريعة
            </p>
            <h3
              className="mb-4 text-[22px] font-bold leading-[1.2] tracking-[-0.015em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              توظيف الفريق · ١٤ يوم
            </h3>
            <div className="space-y-2">
              {[
                ['خالد', 4, 5],
                ['ريم', 3, 5],
                ['فادي', 2, 5],
                ['حمادة', 1, 5],
                ['آدم', 0, 5],
              ].map(([name, load, max]) => (
                <div key={name as string} className="flex items-center gap-3 text-[12px]">
                  <span className="w-16 text-black/70">{name}</span>
                  <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-black/5">
                    <div
                      className="h-full"
                      style={{
                        width: `${((load as number) / (max as number)) * 100}%`,
                        background:
                          (load as number) >= 4
                            ? '#DC2626'
                            : (load as number) >= 3
                              ? '#F59E0B'
                              : '#0A0A0D',
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-black/55">{load as number}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[11px] leading-relaxed text-black/55">
              خالد فوق السقف بـ ٢٠٪. لو ما أعدت توزيع مشروع MG لـ فادي قبل الإثنين، الموعد
              في خطر.
            </p>
          </aside>

          {/* Three short pieces */}
          <ShortPiece
            label="السوشيال"
            title="٢٣ منشور خرجوا الأسبوع، أعلى engagement على BMW Reel ٧"
            icon={Camera}
          />
          <ShortPiece
            label="الإيميل"
            title="رد BMW متأخر ٥٢ ساعة. خالد عنده draft جاهز للمراجعة"
            icon={Mail}
            urgent
          />
          <ShortPiece
            label="الـ Pipeline"
            title="٧ leads جديدة، ٣ منها ساخنة (temperature > ٧٠٪)"
            icon={TrendingUp}
          />

          {/* Bottom feature — activity */}
          <article className="md:col-span-12 border-t border-black/10 pt-8">
            <div className="mb-5 flex items-baseline justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-black/40">
                  — أنشطة اليوم
                </p>
                <h3
                  className="mt-2 text-[28px] font-bold tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  حركة Volt
                </h3>
              </div>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-[12px] text-amber-700 hover:underline"
              >
                كل النشاط
                <ArrowUpRight size={11} className="rtl:rotate-90" />
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-x-10 gap-y-2 md:grid-cols-2">
              {[
                ['١٦:٣٨', 'خالد سلّم مونتاج BMW Summer', 'PRJ-0006'],
                ['١٦:٢١', 'ريم وافقت على Reel 7', 'DEL-0012'],
                ['١٥:٥٨', 'إيميل مرسل لـ Lexus.SA', 'BMW thread'],
                ['١٥:٣٤', 'مهمة جديدة من فادي', 'TASK-0089'],
                ['١٤:٤٥', 'حجز كاميرا Canon R5 للأحد', 'EQ-0001'],
                ['١٤:٢٢', 'AI لخّص ٧ threads', 'GMAIL'],
              ].map(([time, what, ref]) => (
                <li
                  key={ref as string}
                  className="flex items-baseline gap-4 border-b border-black/5 py-2.5 text-[13px]"
                >
                  <span className="font-mono text-[11px] text-black/40">{time}</span>
                  <span className="flex-1 text-black/85">{what}</span>
                  <span className="font-mono text-[10px] uppercase text-black/35">{ref}</span>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <footer className="mt-16 border-t-2 border-black/15 pt-6 text-center">
          <p
            className="text-[36px] font-bold tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Antagna<span className="text-amber-600">.</span>
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-black/40">
            VOLT PRODUCTION · MMXXVI
          </p>
        </footer>
      </div>
    </div>
  );
}

function Feature({
  label,
  value,
  unit,
  delta,
  deltaUp,
  warning,
}: {
  label: string;
  value: string;
  unit: string;
  delta: string;
  deltaUp?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="border-t border-black/15 pt-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-black/40">
        {label}
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className="text-[58px] font-bold leading-none tracking-[-0.04em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {value}
        </span>
        <span className="text-[14px] text-black/55">{unit}</span>
      </div>
      <p
        className={
          'mt-2 text-[12px] ' +
          (warning ? 'text-red-700' : deltaUp ? 'text-emerald-700' : 'text-black/55')
        }
      >
        {deltaUp && '↗ '}
        {warning && '⚠ '}
        {delta}
      </p>
    </div>
  );
}

function ShortPiece({
  label,
  title,
  icon: Icon,
  urgent,
}: {
  label: string;
  title: string;
  icon: typeof Activity;
  urgent?: boolean;
}) {
  return (
    <article className="md:col-span-4 border-t border-black/10 pt-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={14} strokeWidth={1.7} className={urgent ? 'text-red-700' : 'text-black/55'} />
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-black/40">{label}</p>
      </div>
      <h4
        className={
          'text-[18px] font-bold leading-[1.25] tracking-[-0.01em] ' +
          (urgent ? 'text-red-900' : 'text-black')
        }
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h4>
    </article>
  );
}
