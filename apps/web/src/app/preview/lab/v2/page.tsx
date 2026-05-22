import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function V2Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0D] text-white">
      {/* Mesh gradient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(255, 107, 26, 0.18), transparent 50%),
            radial-gradient(ellipse 50% 40% at 80% 30%, rgba(168, 85, 247, 0.12), transparent 50%),
            radial-gradient(ellipse 70% 60% at 50% 100%, rgba(34, 197, 94, 0.10), transparent 60%)
          `,
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-6 py-14 md:px-10 md:py-20">
        <Link
          href="/preview/lab"
          className="mb-10 inline-flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white"
        >
          <ArrowLeft size={13} className="rtl:rotate-180" />
          العودة لـ Design Lab
        </Link>

        <header className="mb-14 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 backdrop-blur-md">
            <span
              className="h-1.5 w-1.5 rounded-full bg-orange-500"
              style={{ boxShadow: '0 0 8px rgba(255,107,26,0.8)' }}
            />
            <span className="text-[11px] font-medium tracking-wide text-white/80">
              Design Lab V2 — Creative Pro
            </span>
          </div>
          <h1
            className="text-[44px] font-bold leading-[0.95] tracking-[-0.025em] text-white md:text-[64px]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            ثلاث رؤى<br />
            <span
              className="bg-gradient-to-l from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent"
              style={{
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              لاستوديو إنتاج
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/65">
            كل رؤية مدرسة بصرية كاملة. الهدف: تبان <em>غالية</em> لما تعرضها قدّام BMW أو
            رولز رويس، وفي نفس الوقت تخدمك يومياً كأداة عمل. اختار اللي بيحرّك إحساسك.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Tile
            href="/preview/lab/v2/editorial"
            tag="A — Editorial"
            title="مجلّة"
            subtitle="Magazine-style hero, big serif-feel display, asymmetric layout. هويّة هادئة فاخرة."
            gradient="from-white/10 to-white/[0.02]"
            ringGlow="rgba(251, 191, 36, 0.25)"
          />
          <Tile
            href="/preview/lab/v2/studio"
            tag="B — Studio"
            title="استوديو"
            subtitle="Bold gradient mesh, vivid accents, big numbers, sparklines. الـ vibe الإبداعي بأقصاه."
            gradient="from-orange-500/20 via-pink-500/15 to-purple-500/20"
            ringGlow="rgba(244, 114, 182, 0.35)"
          />
          <Tile
            href="/preview/lab/v2/glass"
            tag="C — Liquid Glass"
            title="زجاج"
            subtitle="Translucent layers, backdrop refraction, Apple WWDC 2025 aesthetic. مودرن جداً."
            gradient="from-blue-500/10 via-cyan-500/10 to-emerald-500/10"
            ringGlow="rgba(56, 189, 248, 0.30)"
          />
        </div>

        <footer className="mt-14 text-[11px] text-white/40">
          الـ٣ كلهم بنفس البيانات الحقيقية. اختار اللي بيحرّك إحساسك وأطبّق على كل النظام.
        </footer>
      </div>
    </div>
  );
}

function Tile({
  href,
  tag,
  title,
  subtitle,
  gradient,
  ringGlow,
}: {
  href: string;
  tag: string;
  title: string;
  subtitle: string;
  gradient: string;
  ringGlow: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${gradient} p-6 transition-all hover:border-white/25 hover:scale-[1.01]`}
      style={{ backdropFilter: 'blur(20px)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -end-20 h-40 w-40 rounded-full opacity-50 blur-3xl transition-opacity group-hover:opacity-80"
        style={{ background: ringGlow }}
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
        {tag}
      </p>
      <h3
        className="mt-2 text-[42px] font-bold leading-[1.05] tracking-[-0.02em] text-white"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h3>
      <p className="mt-4 text-[12px] leading-relaxed text-white/65">{subtitle}</p>
      <div className="mt-8 flex items-center gap-1.5 text-[11px] text-white/80">
        شوف الـ mockup
        <span className="transition-transform group-hover:translate-x-[-3px] rtl:rotate-180">→</span>
      </div>
    </Link>
  );
}
