import Link from 'next/link';
import { ArrowLeft, Sparkles, Library, LayoutGrid } from 'lucide-react';

export default function V5Index() {
  return (
    <div className="min-h-screen bg-[#0F0F12] text-white">
      <div className="mx-auto max-w-[1200px] px-6 py-14 md:px-10 md:py-20">
        <Link
          href="/preview/lab"
          className="mb-10 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/45 hover:text-white"
        >
          <ArrowLeft size={12} className="rtl:rotate-180" />
          العودة لـ Design Lab
        </Link>

        <header className="mb-12 max-w-3xl">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-[#FF6B1A]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6B1A]">
            <Sparkles size={10} />
            V5 — Cards-only · AI inside
          </p>
          <h1
            className="text-[44px] font-bold leading-[0.98] tracking-[-0.025em] md:text-[58px]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            داش بورد كله<br />
            <span className="text-[#FF6B1A]">كروت ذكية</span>
          </h1>
          <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-white/65">
            مفيش جداول ولا panels — كل حاجة كرت. الـ AI داخل الكروت بنسب مختلفة:
            كروت AI-heavy بتقترح إجراءات، كروت AI-medium بتلون البيانات، كروت AI-light بتلخّص أرقام.
            مكتبة ٢٨ كرت، تخصيص بالحجم والمكان.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            href="/preview/lab/v5/dashboard"
            className="group block overflow-hidden rounded-xl border border-white/10 bg-[#17171C] p-6 transition-colors hover:border-[#FF6B1A]/40"
          >
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-[#FF6B1A]/10">
              <LayoutGrid size={18} className="text-[#FF6B1A]" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              المثال الحي
            </p>
            <h2
              className="mt-1 text-[24px] font-bold tracking-[-0.015em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Bento Dashboard
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-white/65">
              مثال داش بورد كامل بكروت في bento layout. ١٠ كروت ظاهرة من المكتبة،
              drag handles، size cycler، AI badges واضحة.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-[#FF6B1A]">
              افتح →
            </span>
          </Link>

          <Link
            href="/preview/lab/v5/library"
            className="group block overflow-hidden rounded-xl border border-white/10 bg-[#17171C] p-6 transition-colors hover:border-[#FF6B1A]/40"
          >
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-white/8">
              <Library size={18} className="text-white/85" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              المكتبة الكاملة
            </p>
            <h2
              className="mt-1 text-[24px] font-bold tracking-[-0.015em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              ٢٨ كرت
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-white/65">
              كل الكروت اللي ممكن تضيفها للداش بورد، مصنّفين بمستوى الـ AI (heavy /
              medium / light / none) ومجموعة (production / business / analytics / ops).
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-[#FF6B1A]">
              تصفّح المكتبة →
            </span>
          </Link>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/8 md:grid-cols-4">
          <Stat label="إجمالي الكروت" value="28" />
          <Stat label="AI-heavy" value="11" tint />
          <Stat label="AI-medium" value="9" />
          <Stat label="بدون AI" value="8" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: boolean }) {
  return (
    <div className="bg-[#0F0F12] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p
        className={
          'mt-1 font-mono text-[28px] font-semibold tracking-tight ' +
          (tint ? 'text-[#FF6B1A]' : 'text-white')
        }
      >
        {value}
      </p>
    </div>
  );
}
