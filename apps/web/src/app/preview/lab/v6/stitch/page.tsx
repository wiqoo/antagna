'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, ExternalLink, ImageOff } from 'lucide-react';

const STITCH_IMG = '/v6-stitch-concept.png';

export default function V6StitchConcept() {
  const [missing, setMissing] = useState(false);

  return (
    <div className="min-h-screen bg-[#0F0F12] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0F0F12]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5">
          <Link href="/preview/lab/v6" className="inline-flex items-center gap-1.5 text-[11px] text-white/55 hover:text-white">
            <ArrowLeft size={11} className="rtl:rotate-180" />
            <span className="hidden md:inline">V6</span>
          </Link>
          <span className="text-white/20">·</span>
          <h1 className="font-mono text-[12px] font-semibold text-white">stitch_concept</h1>
          <span className="hidden text-[10px] text-white/40 md:inline">Google Stitch · Gemini 3.1 Pro</span>
          <Link href="/preview/lab/v6/dashboard" className="ms-auto inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/65 hover:bg-white/[0.04] hover:text-white">
            الداش بورد المتحرّك
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-8">
        <div className="mb-5 max-w-2xl">
          <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-[#FF6B1A]">
            <Sparkles size={11} /> concept
          </p>
          <h2 className="text-[26px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            مفهوم بديل من Google Stitch
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-white/60">
            تصميم مولّد بالكامل من Stitch لنفس البريف: bento داكن، برتقالي واحد، عناوين monospace.
            هدفه المقارنة مع V5/V6 — مش بديل نهائي. الأجزاء اللي تعجبك ننقلها للكروت الحقيقية.
          </p>
        </div>

        {missing ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-white/[0.12] bg-[#17171C] p-12 text-center">
            <ImageOff size={28} className="mb-3 text-white/35" />
            <p className="text-[13px] text-white/70">المفهوم لسه بيتولّد في Stitch أو لسه ما اتصدّرش هنا.</p>
            <p className="mt-1 text-[11px] text-white/45">هحدّث الصفحة بالصورة أول ما الـ generation يخلص.</p>
          </div>
        ) : (
          <figure className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#17171C]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={STITCH_IMG}
              alt="Stitch-generated Antagna dashboard concept"
              className="w-full"
              onError={() => setMissing(true)}
            />
          </figure>
        )}

        <a
          href="https://stitch.withgoogle.com/"
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-[11px] text-[#FF6B1A] hover:underline"
        >
          افتح في Stitch <ExternalLink size={11} />
        </a>
      </main>
    </div>
  );
}
