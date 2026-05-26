import Link from 'next/link';
import {
  ArrowLeft, Sparkles, Briefcase, Users, Mail, Activity,
  Flame, ArrowUpRight, Calendar, ListChecks,
} from 'lucide-react';

export default function GlassDashboard() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04050B] text-white">
      {/* Layered mesh — softer, more even */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 50% 0%, rgba(56, 189, 248, 0.18), transparent 60%),
            radial-gradient(ellipse 50% 40% at 15% 70%, rgba(167, 139, 250, 0.18), transparent 60%),
            radial-gradient(ellipse 60% 50% at 85% 75%, rgba(45, 212, 191, 0.15), transparent 60%),
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(252, 165, 165, 0.10), transparent 60%)
          `,
        }}
      />

      {/* Refraction blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[10%] right-[10%] h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.4), transparent)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[10%] left-[15%] h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.45), transparent)' }}
      />

      <div className="relative mx-auto max-w-[1300px] px-6 py-10 md:px-10 md:py-14">
        <Link
          href="/preview/lab/v2"
          className="mb-8 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/45 hover:text-white"
        >
          <ArrowLeft size={12} className="rtl:rotate-180" />
          العودة
        </Link>

        {/* Floating top bar — pure liquid glass */}
        <div
          className="mb-8 flex items-center gap-3 rounded-full border border-white/15 px-5 py-2.5"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(30px) saturate(180%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <div
            className="grid h-7 w-7 place-items-center rounded-full text-white"
            style={{
              background: 'linear-gradient(135deg, #38BDF8, #A78BFA)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            A
          </div>
          <span className="text-[13px] font-medium tracking-tight">Antagna</span>
          <span className="text-[11px] text-white/40">·</span>
          <span className="text-[11px] text-white/60">الجمعة ٢٢ مايو</span>
          <div className="ms-auto inline-flex items-center gap-2">
            <kbd
              className="rounded-md border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-white/70"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              ⌘K
            </kbd>
            <span className="text-[11px] text-white/50">للتنقل</span>
          </div>
        </div>

        {/* AI brief — translucent hero */}
        <article
          className="mb-6 overflow-hidden rounded-[32px] border border-white/15 p-8 md:p-12"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
            backdropFilter: 'blur(30px) saturate(180%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Sparkles size={11} className="text-cyan-300" />
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/80">
                  Antagna Intelligence
                </span>
              </div>
              <h1
                className="text-[48px] font-bold leading-[1.0] tracking-[-0.03em] md:text-[64px]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                مرحباً<br />
                <span
                  className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent"
                  style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  Mohammed.
                </span>
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-[1.65] text-white/70">
                ٣ نقاط محتاجة قرارك اليوم. أهمها رولز رويس — التسليم خلال ٧٢ ساعة والإنجاز
                لسه ٤٥٪.
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  className="rounded-full px-5 py-2.5 text-[12px] font-semibold text-[#04050B] transition-all hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, #67E8F9, #A78BFA)',
                    boxShadow: '0 0 30px rgba(103,232,249,0.3)',
                  }}
                >
                  اقرأ النقاط
                </button>
                <button
                  className="rounded-full border border-white/20 px-5 py-2.5 text-[12px] font-medium text-white/90 backdrop-blur-md hover:bg-white/5"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  جدّد
                </button>
              </div>
            </div>

            {/* Bullets list */}
            <ol className="space-y-3">
              {[
                ['01', 'Rolls Royce: ٣ أيام، إنجاز ٤٥٪', '#FB7185', true],
                ['02', 'BMW thread متأخر ٥٢ ساعة', '#FBBF24', false],
                ['03', 'خالد على ٣ مشاريع — أعد التوزيع', '#A78BFA', false],
              ].map(([num, text, color, urgent]) => (
                <li
                  key={num as string}
                  className="flex gap-3 rounded-2xl border border-white/10 p-3"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <span
                      className="font-mono text-[12px] font-bold"
                      style={{ color: color as string }}
                    >
                      {num as string}
                    </span>
                  </div>
                  <p className="flex-1 text-[13px] leading-relaxed text-white/85">
                    {text as string}
                  </p>
                  {(urgent as boolean) && (
                    <span
                      className="self-start rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: 'rgba(244,63,94,0.2)', color: '#FCA5A5' }}
                    >
                      عاجل
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </article>

        {/* Grid of glass tiles */}
        <div className="grid grid-cols-12 gap-3 md:gap-4">
          <GlassTile span="col-span-6 md:col-span-4" tint="rgba(34,197,94,0.10)" glow="#34D399">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-300/80">إيراد الشهر</p>
            <p
              className="mt-2 text-[48px] font-bold leading-none tracking-[-0.03em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              ٤١٠<span className="text-[20px] text-white/40">ك</span>
            </p>
            <p className="mt-2 text-[11px] text-emerald-300">↗ +١٨٪ من الشهر الماضي</p>
          </GlassTile>

          <GlassTile span="col-span-6 md:col-span-4" tint="rgba(167,139,250,0.10)" glow="#A78BFA">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-purple-300/80">مشاريع نشطة</p>
            <p
              className="mt-2 text-[48px] font-bold leading-none tracking-[-0.03em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              ١٢
            </p>
            <p className="mt-2 text-[11px] text-white/55">٤ قريبة التسليم</p>
          </GlassTile>

          <GlassTile span="col-span-12 md:col-span-4" tint="rgba(251,191,36,0.10)" glow="#FBBF24">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-amber-300/80">ينتظر ردنا</p>
            <p
              className="mt-2 text-[48px] font-bold leading-none tracking-[-0.03em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              ٨
            </p>
            <p className="mt-2 text-[11px] text-amber-200/80">٢ أقدم من ٧٢س ⚠</p>
          </GlassTile>

          {/* Today's shoot — wide */}
          <article
            className="col-span-12 overflow-hidden rounded-[24px] border border-white/15 p-7 md:col-span-8"
            style={{
              background:
                'linear-gradient(135deg, rgba(56,189,248,0.10) 0%, rgba(255,255,255,0.02) 100%)',
              backdropFilter: 'blur(30px) saturate(180%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <header className="mb-4 flex items-center gap-2">
              <Calendar size={13} className="text-cyan-300" />
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">اليوم وهذا الأسبوع</p>
            </header>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ShootTile
                title="جولة الشوروم — MG"
                when="٢١:٣٣ اليوم"
                client="إم تي إن للسيارات"
                city="الرياض"
                live
              />
              <ShootTile
                title="BMW Summer Campaign"
                when="غداً ٠٩:٠٠"
                client="BMW السعودية"
                city="جدة"
              />
              <ShootTile
                title="Rolls Royce — interior"
                when="الأحد ١٠:٠٠"
                client="رولز رويس"
                city="الرياض"
              />
              <ShootTile
                title="لكزس LX social"
                when="الاثنين ٠٧:٣٠"
                client="لكزس"
                city="جدة"
              />
            </div>
          </article>

          {/* Capacity meter */}
          <article
            className="col-span-12 overflow-hidden rounded-[24px] border border-white/15 p-6 md:col-span-4"
            style={{
              background:
                'linear-gradient(135deg, rgba(244,114,182,0.10) 0%, rgba(255,255,255,0.02) 100%)',
              backdropFilter: 'blur(30px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <header className="mb-5 flex items-center gap-2">
              <Users size={13} className="text-pink-300" />
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">حمولة الفريق</p>
            </header>
            <div className="space-y-2.5">
              {[
                ['خالد', 4, '#FB7185'],
                ['ريم', 3, '#FBBF24'],
                ['فادي', 2, '#34D399'],
                ['حمادة', 1, '#34D399'],
                ['آدم', 0, '#374151'],
              ].map(([name, load, color]) => (
                <div key={name as string} className="flex items-center gap-3 text-[11.5px]">
                  <span className="w-14 text-white/75">{name}</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full"
                      style={{
                        width: `${((load as number) / 5) * 100}%`,
                        background: color as string,
                        boxShadow: `0 0 8px ${color}`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-white/55">{load as number}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[11px] leading-relaxed text-pink-200/70">
              خالد فوق السقف ٢٠٪. وزّع MG لـ فادي قبل الإثنين.
            </p>
          </article>

          {/* Activity stream — translucent */}
          <article
            className="col-span-12 overflow-hidden rounded-[24px] border border-white/15 p-6"
            style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(30px) saturate(180%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            <header className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={13} className="text-cyan-300" />
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">حركة Volt الآن</p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-1 text-[9px] text-white/55" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D399' }} />
                live
              </div>
            </header>
            <ul className="space-y-1">
              {[
                ['١٦:٣٨', 'خالد سلّم مونتاج BMW', '#34D399'] as const,
                ['١٦:٢١', 'ريم وافقت على Reel 7', '#34D399'] as const,
                ['١٥:٥٨', 'إيميل مرسل لـ Lexus', '#22D3EE'] as const,
                ['١٥:٣٤', 'مهمة جديدة من فادي', '#FB923C'] as const,
                ['١٤:٤٥', 'حجز كاميرا Canon R5', '#22D3EE'] as const,
              ].map(([time, what, color]) => (
                <li
                  key={time + what}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/5"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: color as string,
                      boxShadow: `0 0 8px ${color}`,
                    }}
                  />
                  <span className="font-mono text-[10px] text-white/40">{time}</span>
                  <span className="flex-1 text-[12.5px] text-white/85">{what}</span>
                  <ArrowUpRight size={11} className="text-white/30 rtl:rotate-90" />
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </div>
  );
}

function GlassTile({
  span,
  tint,
  glow,
  children,
}: {
  span: string;
  tint: string;
  glow: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`${span} relative overflow-hidden rounded-[24px] border border-white/15 p-5`}
      style={{
        background: `linear-gradient(135deg, ${tint} 0%, rgba(255,255,255,0.02) 100%)`,
        backdropFilter: 'blur(30px) saturate(180%)',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -end-10 h-24 w-24 rounded-full opacity-50 blur-2xl"
        style={{ background: glow }}
      />
      <div className="relative">{children}</div>
    </article>
  );
}

function ShootTile({
  title,
  when,
  client,
  city,
  live,
}: {
  title: string;
  when: string;
  client: string;
  city: string;
  live?: boolean;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/10 p-4"
      style={{
        background: live
          ? 'linear-gradient(135deg, rgba(56,189,248,0.18), rgba(167,139,250,0.10))'
          : 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[12px] text-white">{when}</span>
        {live && (
          <span className="rounded-full bg-cyan-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300">
            اليوم
          </span>
        )}
      </div>
      <p className="text-[13px] font-medium text-white">{title}</p>
      <p className="mt-1 text-[11px] text-white/55">
        {client} · {city}
      </p>
    </div>
  );
}
