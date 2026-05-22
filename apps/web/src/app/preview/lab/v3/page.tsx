import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function V3Index() {
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

        <header className="mb-14 max-w-3xl">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-[#FF6B1A]">
            V3 — ALL QUIET, ALL ORANGE
          </p>
          <h1
            className="text-[44px] font-bold leading-[0.98] tracking-[-0.025em] text-white md:text-[60px]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            ثلاث رؤى<br />
            بالـ palette الحالية
          </h1>
          <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-white/65">
            مفيش purple/cyan/pink، مفيش glow، مفيش gradient ملوّن. لون واحد accent (البرتقالي
            الحالي)، خلفية الـ system، تباين عالي. الـ design كله جاي من <em>المسافات + الـ
            typography</em>.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Tile
            href="/preview/lab/v3/calm"
            tag="A — Calm"
            arabicTag="هادئ"
            subtitle="Editorial dark — مساحات واسعة، خط display، orange dots كأنها علامات ترقيم."
            sample={<CalmSample />}
          />
          <Tile
            href="/preview/lab/v3/precise"
            tag="B — Precise"
            arabicTag="دقيق"
            subtitle="Linear-style — كثيف لكن مرتب، مونوسبيس للأرقام، orange بس على المختار."
            sample={<PreciseSample />}
          />
          <Tile
            href="/preview/lab/v3/spaced"
            tag="C — Spaced"
            arabicTag="مساحات"
            subtitle="Vercel Geist-like — أرقام ضخمة، hairline borders، orange على نقاط واحدة فقط."
            sample={<SpacedSample />}
          />
        </div>

        <footer className="mt-14 border-t border-white/8 pt-6 text-[11px] text-white/40">
          الـ٣ بنفس بياناتك. اختار اللي بيريّحك.
        </footer>
      </div>
    </div>
  );
}

function Tile({
  href,
  tag,
  arabicTag,
  subtitle,
  sample,
}: {
  href: string;
  tag: string;
  arabicTag: string;
  subtitle: string;
  sample: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-[#17171C] transition-all hover:border-[#FF6B1A]/40"
    >
      <div className="border-b border-white/8 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
          {tag}
        </p>
        <h3
          className="mt-1 text-[28px] font-bold tracking-[-0.02em] text-white"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {arabicTag}
        </h3>
        <p className="mt-3 text-[12px] leading-relaxed text-white/65">{subtitle}</p>
      </div>
      <div className="p-4">{sample}</div>
      <div className="border-t border-white/8 px-5 py-3 text-[11px] text-white/50 group-hover:text-[#FF6B1A]">
        افتح →
      </div>
    </Link>
  );
}

function CalmSample() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[9px] uppercase tracking-[0.22em] text-white/35">إيراد الشهر</p>
        <p className="font-mono text-[28px] font-bold tracking-tight text-white">٤١٠<span className="text-white/35">ك</span></p>
      </div>
      <div className="h-px bg-white/8" />
      <div className="flex items-center gap-2 text-[11px]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B1A]" />
        <span className="text-white/80">يوم ضغط على التسليم</span>
      </div>
    </div>
  );
}
function PreciseSample() {
  return (
    <div className="space-y-1.5 font-mono text-[11px]">
      <Row label="revenue.mtd" v="410,232" />
      <Row label="projects" v="12" />
      <Row label="awaiting" v="8" accent />
      <Row label="overdue" v="1" />
    </div>
  );
}
function SpacedSample() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="font-mono text-[22px] font-bold text-white">٤١٠</p>
        <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/40">إيراد</p>
      </div>
      <div>
        <p className="font-mono text-[22px] font-bold text-[#FF6B1A]">١٢</p>
        <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/40">مشاريع</p>
      </div>
    </div>
  );
}
function Row({ label, v, accent }: { label: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/45">{label}</span>
      <span className={accent ? 'text-[#FF6B1A]' : 'text-white/90'}>{v}</span>
    </div>
  );
}
