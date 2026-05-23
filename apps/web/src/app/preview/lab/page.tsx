import Link from 'next/link';
import {
  Type, List, Sparkles, Palette, Menu, LayoutDashboard, Grid, Layers,
} from 'lucide-react';

const SECTIONS = [
  {
    href: '/preview/lab/typography',
    title: 'الخطوط والألوان',
    desc: 'مقارنة سلم الخطوط + ٣ خيارات لتباين النصوص (المعظم مش واضح حالياً).',
    icon: Type,
    items: 4,
  },
  {
    href: '/preview/lab/lists',
    title: 'شكل القوائم',
    desc: 'الـ table الحالي مقابل ٤ بدائل (cards / compact rows / magazine grid / dense).',
    icon: List,
    items: 4,
  },
  {
    href: '/preview/lab/icons',
    title: 'الأيقونات',
    desc: 'Lucide outline (الحالي) vs Lucide thick vs Phosphor duotone vs Heroicons solid.',
    icon: Layers,
    items: 4,
  },
  {
    href: '/preview/lab/effects',
    title: 'التأثيرات والـ animations',
    desc: 'hover lift, magnet pull (الحالي), ripple, fade-in, parallax, subtle shift.',
    icon: Sparkles,
    items: 6,
  },
  {
    href: '/preview/lab/nav',
    title: 'القائمة الجانبية',
    desc: 'الـ split الحالي (٥/٨) مقابل ٣ مقترحات لإعادة التقسيم.',
    icon: Menu,
    items: 4,
  },
  {
    href: '/preview/lab/dashboard',
    title: 'تخطيط الداش بورد',
    desc: '٤ تصميمات بديلة: zones, hero+rail, magazine, command-center.',
    icon: LayoutDashboard,
    items: 4,
  },
  {
    href: '/preview/lab/cards',
    title: 'كروت جديدة للداش بورد',
    desc: '١٢ فكرة كرت إضافي (cashflow, AI cost, team availability, ...). شوف نمطها واختار.',
    icon: Grid,
    items: 12,
  },
  {
    href: '/preview/lab/customize',
    title: 'تخصيص أذكى',
    desc: 'حفظ "views" متعددة، حجم/أعمدة لكل كرت، ترتيب بالسحب، تخصيص لكل دور.',
    icon: Palette,
    items: 4,
  },
] as const;

export default function PreviewLabIndex() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[1200px] px-6 py-12 md:px-8 md:py-16">
        <header className="mb-10 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            — Design Lab
          </p>
          <h1
            className="text-[36px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[44px]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            اختياراتنا قبل ما نطبّق
          </h1>
          <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--text-muted)]">
            كل قسم فيه مقارنة بصرية. اضغط على القسم اللي يهمّك، شوف الخيارات
            جنب بعض، وقولي رقم الخيار اللي عاجبك. لما تختار، أطبّق على الإنتاج.
          </p>
        </header>

        {/* V5 — Bento + AI cards */}
        <Link
          href="/preview/lab/v5"
          className="group mb-4 block overflow-hidden rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-5 transition-all hover:bg-[var(--bg-elevated)]"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-2 inline-block rounded bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-black">
                V5 · BENTO · 28 AI CARDS
              </p>
              <h2
                className="text-[24px] font-bold leading-[1.15] tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                داش بورد كله كروت ذكية + مكتبة ٢٨ كرت
              </h2>
              <p className="mt-2 max-w-xl text-[12px] text-[var(--text-muted)]">
                ١١ كرت AI-heavy (AI بيقترح إجراءات) · ٩ كرت AI-medium (AI يثري البيانات) ·
                ٥ كرت AI-light · ٣ بدون AI. تخصيص بالحجم والمكان، شريط برتقالي فوق كل كرت AI.
              </p>
            </div>
            <span className="font-mono text-[14px] text-[var(--accent)] transition-transform group-hover:-translate-x-1 rtl:rotate-180">
              ▸ افتح
            </span>
          </div>
        </Link>

        {/* V4 — Workbench / Frame.io style */}
        <Link
          href="/preview/lab/v4"
          className="group mb-4 block overflow-hidden rounded-xl border border-[var(--accent)] bg-[#0F0F12] p-5 transition-all hover:bg-[#17171C]"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-2 inline-block rounded bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-black">
                V4 · WORKBENCH · pro tool feel
              </p>
              <h2
                className="text-[24px] font-bold leading-[1.15] tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                صفحة واحدة بـ feel أداة فيديو احترافية — Frame.io / Final Cut Pro
              </h2>
              <p className="mt-2 max-w-xl text-[12px] text-[var(--text-muted)]">
                Sidebar workspace nav · HUD strip · clip-style shoot browser بـ thumbnails ·
                AI inspector جانبي · capacity heatmap بأسلوب timeline · status bar أسفل.
                البرتقالي الحالي بس، مفيش purple/cyan/glow.
              </p>
            </div>
            <span className="font-mono text-[14px] text-[var(--accent)] transition-transform group-hover:-translate-x-1 rtl:rotate-180">
              ▸ افتح
            </span>
          </div>
        </Link>

        {/* V3 hero — restrained, single accent */}
        <Link
          href="/preview/lab/v3"
          className="group mb-4 block overflow-hidden rounded-xl border border-[var(--accent)]/30 bg-[var(--surface)] p-5 transition-all hover:border-[var(--accent)]/60"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-2 inline-block rounded bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                V3 · بالـ palette الحالية
              </p>
              <h2
                className="text-[24px] font-bold leading-[1.15] tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                ٣ رؤى هادئة — برتقالي واحد، مفيش زجاج، مفيش gradient ملوّن
              </h2>
              <p className="mt-2 max-w-xl text-[12px] text-[var(--text-muted)]">
                Calm (مجلّة دارك) · Precise (Linear terminal) · Spaced (Vercel Geist).
                نفس الـ palette الحالية، الـ design كله من المسافات والـ typography.
              </p>
            </div>
            <span className="text-[18px] text-[var(--accent)] transition-transform group-hover:-translate-x-1 rtl:rotate-180">
              →
            </span>
          </div>
        </Link>

        {/* V2 — kept as alt */}
        <Link
          href="/preview/lab/v2"
          className="group mb-10 block rounded-xl border border-white/10 bg-[var(--bg-elevated)]/40 p-4 text-[12px] text-[var(--text-muted)] hover:border-white/20"
        >
          <span className="text-[var(--text)]">V2 — الـ ٣ تصميمات الأولى (Editorial / Studio / Glass)</span>
          <span className="ms-2 text-[var(--text-dim)]">— الأوفر اللي اتقالك عنها. متاحة للمقارنة لو احتجت.</span>
        </Link>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group block rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--bg-elevated)]"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-lg"
                    style={{
                      background: 'var(--accent-tint)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text)]">
                      {s.title}
                    </h2>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
                      {s.items} خيار
                    </p>
                  </div>
                  <span className="text-[var(--text-dim)] transition-all group-hover:translate-x-[-4px] group-hover:text-[var(--accent)] rtl:rotate-180">
                    →
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                  {s.desc}
                </p>
              </Link>
            );
          })}
        </div>

        <footer className="mt-12 flex items-center justify-between border-t border-[var(--line)] pt-6 text-[11px] text-[var(--text-dim)]">
          <span>هذه صفحات معاينة فقط — لم يتم تطبيق أي تغيير على الإنتاج بعد.</span>
          <Link
            href="/dashboard"
            className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            ← العودة للداش بورد
          </Link>
        </footer>
      </div>
    </div>
  );
}
