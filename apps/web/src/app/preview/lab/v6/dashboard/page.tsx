'use client';

/**
 * V6 — V5 bento with the "clean" card skin + tasteful Framer Motion.
 * Fixes from feedback: drag no longer hijacks scrolling (reorder/resize are
 * button-driven in an explicit "ترتيب" mode); clean Arabic titles instead of
 * // code labels; higher text contrast; quick actions inside each card.
 * Motion stays physical: spring entrance stagger, hover lift, layout-spring
 * reflow when cards are reordered/resized. Palette unchanged (orange only).
 */
import { useState } from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import {
  ArrowLeft, Shuffle, Sliders, Check, Maximize2, EyeOff, ChevronUp, ChevronDown,
  Reply, CheckCheck, Send, CalendarDays, ArrowUpRight, Wrench, Users,
  MoreHorizontal, Eye, Sparkles,
} from 'lucide-react';
import {
  cardSpanClass, CardSkin, CARD_SIZES, CARD_BY_ID, type CardSize, type CardId,
  CardAIBrief, CardGlance, CardEmailTriage, CardSmartSuggestions,
  CardProjectHealth, CardCapacityForecast, CardApprovals, CardStaleConvos,
  CardTodayShoots, CardEquipmentConflicts, CardMTDRevenue, CardAtRisk,
  CardHotLeads, CardNextActions, CardAITip, CardClientSentiment,
} from '@/app/dashboard/cards';

type Item = { id: CardId; size: CardSize; Comp: React.ComponentType<{ size?: CardSize }> };

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

const SIZE_LABEL: Record<CardSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL', full: 'كامل' };

// Primary quick action per card (icon + Arabic label). Shown on hover.
const QA: Partial<Record<CardId, { Icon: typeof Reply; label: string }>> = {
  email_triage: { Icon: Reply, label: 'رد' },
  ai_suggestions: { Icon: CheckCheck, label: 'مراجعة' },
  project_health: { Icon: ArrowUpRight, label: 'فتح' },
  capacity_fc: { Icon: Users, label: 'الفريق' },
  approvals: { Icon: Check, label: 'موافقة' },
  stale_convos: { Icon: Send, label: 'متابعة' },
  shoots: { Icon: CalendarDays, label: 'التقويم' },
  equip_conflicts: { Icon: Wrench, label: 'حل' },
  mtd_revenue: { Icon: ArrowUpRight, label: 'تفاصيل' },
  at_risk: { Icon: ArrowUpRight, label: 'فتح' },
  glance: { Icon: ArrowUpRight, label: 'الكل' },
  next_actions: { Icon: Check, label: 'تم' },
  hot_leads: { Icon: ArrowUpRight, label: 'اتصل' },
};

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 150, damping: 18 } },
};

function QuickActions({ id }: { id: CardId }) {
  const a = QA[id];
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <>
      {a && (
        <button
          onClick={stop}
          className="inline-flex items-center gap-1 rounded-md border border-[#FF6B1A]/40 px-1.5 py-0.5 text-[10px] font-semibold text-[#FF6B1A] hover:bg-[#FF6B1A]/10"
        >
          <a.Icon size={10} />
          {a.label}
        </button>
      )}
      <button onClick={stop} className="grid h-5 w-5 place-items-center rounded text-white/45 hover:bg-white/[0.06] hover:text-white">
        <MoreHorizontal size={12} />
      </button>
    </>
  );
}

export default function V6Dashboard() {
  const [items, setItems] = useState<Item[]>(INITIAL);
  const [hidden, setHidden] = useState<CardId[]>([]);
  const [editing, setEditing] = useState(false);

  const visible = items.filter((it) => !hidden.includes(it.id));

  const cycleSize = (id: CardId) =>
    setItems((p) => p.map((it) => (it.id === id ? { ...it, size: CARD_SIZES[(CARD_SIZES.indexOf(it.size) + 1) % CARD_SIZES.length]! } : it)));

  const hide = (id: CardId) => setHidden((h) => [...h, id]);
  const restoreAll = () => setHidden([]);

  function bump(id: CardId, dir: -1 | 1) {
    setItems((p) => {
      const idx = p.findIndex((it) => it.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= p.length) return p;
      const a = [...p];
      const tmp = a[idx]!; a[idx] = a[j]!; a[j] = tmp;
      return a;
    });
  }

  function shuffle() {
    setItems((p) => {
      const a = [...p];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]!; a[i] = a[j]!; a[j] = t;
      }
      return a;
    });
  }

  return (
    <div className="min-h-screen bg-[#0F0F12] text-white" style={{ fontFamily: 'var(--font-arabic-display), var(--font-arabic), sans-serif' }}>
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0F0F12]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5">
          <Link href="/preview/lab/v6" className="inline-flex items-center gap-1.5 text-[11px] text-white/55 hover:text-white">
            <ArrowLeft size={11} className="rtl:rotate-180" />
            <span className="hidden md:inline">V6</span>
          </Link>
          <span className="text-white/20">·</span>
          <h1 className="font-mono text-[12px] font-semibold text-white">dashboard</h1>
          <div className="ms-auto flex items-center gap-2">
            {hidden.length > 0 && (
              <button onClick={restoreAll} className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/65 hover:bg-white/[0.04] hover:text-white">
                <Eye size={11} /> إظهار الكل ({hidden.length})
              </button>
            )}
            <button onClick={shuffle} className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/65 hover:bg-white/[0.04] hover:text-white">
              <Shuffle size={11} /> إعادة ترتيب
            </button>
            <Link href="/preview/lab/v6/stitch" className="hidden items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/65 hover:bg-white/[0.04] hover:text-white sm:inline-flex">
              مفهوم Stitch
            </Link>
            <button
              onClick={() => setEditing((v) => !v)}
              className={'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ' +
                (editing ? 'bg-[#FF6B1A] text-black hover:bg-[#FF8442]' : 'border border-white/[0.08] text-white/65 hover:bg-white/[0.04] hover:text-white')}
            >
              {editing ? <><Check size={11} /> تم</> : <><Sliders size={11} /> ترتيب</>}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] p-4">
        <p className="mb-3 text-[11px] text-white/45">
          {editing
            ? 'وضع الترتيب: استخدم الأسهم لتحريك الكرت، زر الحجم لتكبيره/تصغيره، والعين لإخفائه.'
            : 'مرّر بالماوس على أي كرت تظهر الأكشنز السريعة. اضغط "ترتيب" لإعادة التنظيم.'}
        </p>

        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-12 gap-3">
          {visible.map(({ id, size, Comp }) => (
            <motion.div
              key={id}
              layout
              variants={item}
              whileHover={editing ? undefined : { y: -4, transition: { type: 'spring', stiffness: 300, damping: 24 } }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className={cardSpanClass(size) + ' relative'}
            >
              {editing && (
                <div className="absolute end-2 top-2 z-30 flex items-center gap-0.5 rounded-md border border-white/[0.1] bg-[#0F0F12]/90 p-0.5 backdrop-blur">
                  <button onClick={() => bump(id, -1)} title="لأعلى" className="grid h-6 w-6 place-items-center rounded text-white/55 hover:bg-white/[0.08] hover:text-white"><ChevronUp size={12} /></button>
                  <button onClick={() => bump(id, 1)} title="لأسفل" className="grid h-6 w-6 place-items-center rounded text-white/55 hover:bg-white/[0.08] hover:text-white"><ChevronDown size={12} /></button>
                  <button onClick={() => cycleSize(id)} title="الحجم" className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-white/65 hover:bg-white/[0.08] hover:text-white"><Maximize2 size={11} /><span className="font-mono text-[9px]">{SIZE_LABEL[size]}</span></button>
                  <button onClick={() => hide(id)} title="إخفاء" className="grid h-6 w-6 place-items-center rounded text-white/55 hover:bg-[#FF6B1A]/15 hover:text-[#FF6B1A]"><EyeOff size={12} /></button>
                </div>
              )}
              <CardSkin variant="clean" title={CARD_BY_ID[id]?.titleAr} actions={editing ? undefined : <QuickActions id={id} />}>
                <Comp size={size} />
              </CardSkin>
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-8 flex items-center justify-between rounded-xl border border-dashed border-white/[0.08] bg-[#17171C] px-4 py-3 text-[11px] text-white/55">
          <span className="flex items-center gap-2">
            <Sparkles size={11} className="text-[#FF6B1A]" />
            V6 — سكين نظيف (عناوين عربية، تباين أعلى، أكشنز داخل الكروت) + موشن بدون ما يعطّل السكرول.
          </span>
          <Link href="/preview/lab/v5/dashboard" className="text-[#FF6B1A] hover:underline">قارن بـ V5 →</Link>
        </div>
      </main>
    </div>
  );
}
