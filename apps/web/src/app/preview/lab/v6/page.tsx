import Link from 'next/link';
import { ArrowLeft, Activity, LayoutGrid, Sparkles } from 'lucide-react';

export default function V6Index() {
  return (
    <div className="min-h-screen bg-[#0F0F12] text-white">
      <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-8 md:py-14">
        <Link href="/preview/lab" className="mb-8 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/45 hover:text-white">
          <ArrowLeft size={12} className="rtl:rotate-180" />
          العودة
        </Link>

        <header className="mb-10 max-w-2xl">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-[#FF6B1A]">— V6 · motion + concepts</p>
          <h1 className="text-[40px] font-bold leading-[1.05] tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            V6 — حركة "antigravity"
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-white/65">
            نفس بنتو V5 وبياناته، لكن بطبقة موشن من Framer Motion: دخول spring متدرّج،
            رفع خفيف عند الـ hover، سحب الكرت ليطفو ويرجع مكانه، وإعادة تدفّق بنبضة عند الترتيب.
            وجنبه مفهوم بديل مولّد من Google Stitch للمقارنة. كله بنفس الباليت (برتقالي واحد).
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/preview/lab/v6/dashboard" className="group rounded-2xl border border-white/[0.08] bg-[#17171C] p-6 transition-colors hover:border-[#FF6B1A]/40">
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B1A]/15 text-[#FF6B1A]">
              <Activity size={16} />
            </div>
            <h2 className="text-[17px] font-semibold">الداش بورد المتحرّك</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
              V5 + Framer Motion. اسحب، كبّر/صغّر، أعد الترتيب — وشوف الفيزياء.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF6B1A]">
              افتح <LayoutGrid size={12} />
            </span>
          </Link>

          <Link href="/preview/lab/v6/stitch" className="group rounded-2xl border border-white/[0.08] bg-[#17171C] p-6 transition-colors hover:border-[#FF6B1A]/40">
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B1A]/15 text-[#FF6B1A]">
              <Sparkles size={16} />
            </div>
            <h2 className="text-[17px] font-semibold">مفهوم Google Stitch</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
              تصميم بديل مولّد بالكامل من Stitch بنفس قيود الباليت — للمقارنة.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF6B1A]">
              افتح <Sparkles size={12} />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
