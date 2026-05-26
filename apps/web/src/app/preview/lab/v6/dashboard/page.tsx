'use client';

/**
 * V6 — the V5 bento with "antigravity" motion (Framer Motion).
 * Physics, not decoration: spring entrance stagger, weightless hover lift,
 * pick-up-and-snap-back drag, layout-spring reflow on shuffle/resize, and a
 * pointer-parallax hero. Same locked palette as V5 (orange #FF6B1A only).
 *
 * Preview-only: reuses the shared dashboard cards with their sample data.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  motion, useMotionValue, useSpring, useTransform, type Variants,
} from 'framer-motion';
import { ArrowLeft, Shuffle, Library, Maximize2, Sparkles } from 'lucide-react';
import {
  cardSpanClass, type CardSize,
  CardAIBrief, CardGlance, CardEmailTriage, CardSmartSuggestions,
  CardProjectHealth, CardCapacityForecast, CardApprovals, CardStaleConvos,
  CardTodayShoots, CardEquipmentConflicts, CardMTDRevenue, CardAtRisk,
  CardHotLeads, CardNextActions, CardAITip, CardClientSentiment,
} from '@/app/dashboard/cards';

type Item = { id: string; size: CardSize; Comp: React.ComponentType<{ size?: CardSize }> };

const INITIAL: Item[] = [
  { id: 'ai_brief', size: 'lg', Comp: CardAIBrief },
  { id: 'glance', size: 'sm', Comp: CardGlance },
  { id: 'mtd_revenue', size: 'sm', Comp: CardMTDRevenue },
  { id: 'email_triage', size: 'md', Comp: CardEmailTriage },
  { id: 'ai_suggestions', size: 'md', Comp: CardSmartSuggestions },
  { id: 'next_actions', size: 'md', Comp: CardNextActions },
  { id: 'project_health', size: 'lg', Comp: CardProjectHealth },
  { id: 'capacity_fc', size: 'lg', Comp: CardCapacityForecast },
  { id: 'approvals', size: 'md', Comp: CardApprovals },
  { id: 'stale_convos', size: 'md', Comp: CardStaleConvos },
  { id: 'shoots', size: 'md', Comp: CardTodayShoots },
  { id: 'hot_leads', size: 'md', Comp: CardHotLeads },
  { id: 'client_mood', size: 'md', Comp: CardClientSentiment },
  { id: 'at_risk', size: 'md', Comp: CardAtRisk },
  { id: 'ai_tip', size: 'md', Comp: CardAITip },
  { id: 'equip_conflicts', size: 'sm', Comp: CardEquipmentConflicts },
];

const SIZES: CardSize[] = ['sm', 'md', 'lg', 'xl', 'full'];
const SIZE_LABEL: Record<CardSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL', full: 'كامل' };

const SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 26, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 140, damping: 18 } },
};

/** Pointer-parallax wrapper for the hero — tilts toward the cursor. */
function Tilt({ children }: { children: React.ReactNode }) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [5, -5]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-5, 5]), { stiffness: 200, damping: 18 });
  return (
    <motion.div
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => { px.set(0); py.set(0); }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

export default function V6Dashboard() {
  const [items, setItems] = useState<Item[]>(INITIAL);

  function cycleSize(id: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, size: SIZES[(SIZES.indexOf(it.size) + 1) % SIZES.length]! } : it,
      ),
    );
  }

  function shuffle() {
    setItems((prev) => {
      const a = [...prev];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i]!;
        a[i] = a[j]!;
        a[j] = tmp;
      }
      return a;
    });
  }

  return (
    <div className="min-h-screen bg-[#0F0F12] text-white">
      {/* Header strip */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0F0F12]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5">
          <Link href="/preview/lab" className="inline-flex items-center gap-1.5 text-[11px] text-white/55 hover:text-white">
            <ArrowLeft size={11} className="rtl:rotate-180" />
            <span className="hidden md:inline">العودة</span>
          </Link>
          <span className="text-white/20">·</span>
          <h1 className="font-mono text-[12px] font-semibold text-white">dashboard_v6</h1>
          <span className="hidden text-[10px] text-white/40 md:inline">antigravity · framer-motion</span>
          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={shuffle}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/65 hover:bg-white/[0.04] hover:text-white"
            >
              <Shuffle size={11} />
              إعادة ترتيب
            </button>
            <Link href="/preview/lab/v6/stitch" className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/65 hover:bg-white/[0.04] hover:text-white">
              <Library size={11} />
              مفهوم Stitch
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] p-4">
        <p className="mb-3 font-mono text-[10px] text-white/40">
          اسحب أي كرت ليطفو ويرجع مكانه · اضغط <Maximize2 size={9} className="inline" /> لتغيير الحجم · "إعادة ترتيب" يعيد توزيعها بنبضة spring
        </p>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-12 gap-3"
        >
          {items.map(({ id, size, Comp }) => {
            const isHero = id === 'ai_brief';
            return (
              <motion.div
                key={id}
                layout
                variants={item}
                drag
                dragSnapToOrigin
                dragElastic={0.16}
                dragMomentum={false}
                whileHover={{ y: -6, transition: SPRING }}
                whileTap={{ scale: 0.99 }}
                whileDrag={{ scale: 1.04, zIndex: 50, cursor: 'grabbing' }}
                transition={SPRING}
                className={cardSpanClass(size) + ' group/cell relative cursor-grab active:cursor-grabbing'}
              >
                {/* size control */}
                <button
                  onClick={() => cycleSize(id)}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  title="غيّر الحجم"
                  className="absolute end-2 top-2 z-30 inline-flex h-6 items-center gap-1 rounded-md border border-white/[0.1] bg-[#0F0F12]/90 px-1.5 text-white/55 opacity-0 backdrop-blur transition-opacity hover:text-white group-hover/cell:opacity-100"
                >
                  <Maximize2 size={11} />
                  <span className="font-mono text-[9px]">{SIZE_LABEL[size]}</span>
                </button>
                {isHero ? <Tilt><Comp size={size} /></Tilt> : <Comp size={size} />}
              </motion.div>
            );
          })}
        </motion.div>

        <div className="mt-8 flex items-center justify-between rounded-xl border border-dashed border-white/[0.08] bg-[#17171C] px-4 py-3 text-[11px] text-white/55">
          <span className="flex items-center gap-2">
            <Sparkles size={11} className="text-[#FF6B1A]" />
            V6 = نفس بيانات V5 + موشن. الحركة فيزياء (دخول/طفو/إعادة تدفق)، مش ألوان.
          </span>
          <Link href="/preview/lab/v5/dashboard" className="text-[#FF6B1A] hover:underline">قارن بـ V5 →</Link>
        </div>
      </main>
    </div>
  );
}
