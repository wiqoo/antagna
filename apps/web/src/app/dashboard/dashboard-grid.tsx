'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import {
  Sliders, Check, Plus, RotateCcw, Maximize2, EyeOff, GripVertical,
  ChevronUp, ChevronDown, X,
} from 'lucide-react';
import { cardSpanClass, CARD_SIZES, type CardSize } from './cards/shell';
import {
  CARD_BY_ID, DEFAULT_LAYOUT, type CardId, type DashLayout,
} from './cards/catalog';
import { saveDashboardLayout, resetDashboardLayout } from './dashboard-layout-actions';

type Item = { id: CardId; node: ReactNode };

const SIZE_LABEL: Record<CardSize, string> = {
  sm: 'S', md: 'M', lg: 'L', xl: 'XL', full: 'كامل',
};

export function DashboardGrid({
  items,
  initialLayout,
  catalogCount,
}: {
  items: Item[];
  initialLayout: DashLayout;
  catalogCount: number;
}) {
  const [layout, setLayout] = useState<DashLayout>(initialLayout);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<CardId | null>(null);
  const [overId, setOverId] = useState<CardId | null>(null);
  const [, startTransition] = useTransition();

  const nodeById = useMemo(() => {
    const m = new Map<CardId, ReactNode>();
    for (const it of items) m.set(it.id, it.node);
    return m;
  }, [items]);
  const liveIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  // Only the cards we actually have a node for, in the user's order,
  // minus the hidden set.
  const hiddenSet = useMemo(() => new Set(layout.hidden), [layout.hidden]);
  const visible = layout.order.filter((id) => liveIds.has(id) && !hiddenSet.has(id));
  const hiddenLive = layout.order.filter((id) => liveIds.has(id) && hiddenSet.has(id));

  function persist(next: DashLayout) {
    setLayout(next);
    startTransition(() => { void saveDashboardLayout(next); });
  }

  function cycleSize(id: CardId) {
    const cur = layout.sizes[id] ?? CARD_BY_ID[id]?.defaultSize ?? 'md';
    const next = CARD_SIZES[(CARD_SIZES.indexOf(cur) + 1) % CARD_SIZES.length];
    persist({ ...layout, sizes: { ...layout.sizes, [id]: next } });
  }

  function hide(id: CardId) {
    persist({ ...layout, hidden: [...layout.hidden, id] });
  }

  function show(id: CardId) {
    persist({ ...layout, hidden: layout.hidden.filter((x) => x !== id) });
  }

  // Move `from` to sit immediately before `to` in the full order array.
  function reorder(from: CardId, to: CardId) {
    if (from === to) return;
    const order = [...layout.order];
    const fromIdx = order.indexOf(from);
    if (fromIdx === -1) return;
    order.splice(fromIdx, 1);
    const toIdx = order.indexOf(to);
    order.splice(toIdx === -1 ? order.length : toIdx, 0, from);
    persist({ ...layout, order });
  }

  // Touch / keyboard fallback for drag: bump a card one slot among the visible.
  function bump(id: CardId, dir: -1 | 1) {
    const idx = visible.indexOf(id);
    const target = visible[idx + dir];
    if (!target) return;
    if (dir === -1) reorder(id, target);
    else {
      // move `id` to just after `target`
      const order = [...layout.order];
      order.splice(order.indexOf(id), 1);
      const tIdx = order.indexOf(target);
      order.splice(tIdx + 1, 0, id);
      persist({ ...layout, order });
    }
  }

  function reset() {
    setLayout(DEFAULT_LAYOUT);
    setEditing(false);
    setAdding(false);
    startTransition(() => { void resetDashboardLayout(); });
  }

  return (
    <section>
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-[18px] font-bold tracking-[-0.018em]" style={{ fontFamily: 'var(--font-display)' }}>
          اللوحة
        </h2>
        <span className="font-mono text-[10px] text-white/40">
          {visible.length}/{catalogCount} كرت
        </span>

        <div className="relative ms-auto flex items-center gap-2">
          {editing && (
            <>
              <button
                type="button"
                onClick={() => setAdding((v) => !v)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#17171C] px-2.5 text-[11px] text-white/65 hover:border-white/[0.16] hover:text-white"
              >
                <Plus size={11} />
                إضافة كرت
                {hiddenLive.length > 0 && (
                  <span className="font-mono text-[9px] text-white/40">({hiddenLive.length})</span>
                )}
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#17171C] px-2.5 text-[11px] text-white/55 hover:border-white/[0.16] hover:text-white"
                title="إعادة الضبط الافتراضي"
              >
                <RotateCcw size={11} />
                إعادة ضبط
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => { setEditing((v) => !v); setAdding(false); }}
            className={
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold ' +
              (editing
                ? 'bg-[#FF6B1A] text-black hover:bg-[#FF8442]'
                : 'border border-white/[0.08] bg-[#17171C] text-white/65 hover:border-white/[0.16] hover:text-white')
            }
          >
            {editing ? <><Check size={11} /> تم</> : <><Sliders size={11} /> تخصيص</>}
          </button>

          {/* Add-card popover */}
          {editing && adding && (
            <div className="absolute end-0 top-9 z-30 w-72 rounded-xl border border-white/[0.1] bg-[#17171C] p-2 shadow-2xl">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">// add_card</span>
                <button type="button" onClick={() => setAdding(false)} className="text-white/40 hover:text-white">
                  <X size={12} />
                </button>
              </div>
              {hiddenLive.length === 0 ? (
                <p className="px-2 py-3 text-[11px] text-white/45">كل الكروت المتاحة ظاهرة بالفعل.</p>
              ) : (
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {hiddenLive.map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => { show(id); }}
                        className="flex w-full items-center gap-2 rounded-md border border-white/[0.05] bg-[#0F0F12] px-2.5 py-2 text-start hover:border-white/[0.14]"
                      >
                        <Plus size={11} className="text-[#FF6B1A]" />
                        <span className="flex-1 truncate text-[11.5px] text-white/85">{CARD_BY_ID[id]?.title}</span>
                        <span className="font-mono text-[9px] text-white/35">{CARD_BY_ID[id]?.ai !== 'none' ? 'AI' : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {editing && (
          <p className="w-full font-mono text-[10px] text-white/40">
            اسحب الكرت لإعادة ترتيبه · اضغط <Maximize2 size={9} className="inline" /> لتغيير الحجم · <EyeOff size={9} className="inline" /> للإخفاء
          </p>
        )}
      </header>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.1] bg-[#17171C] p-8 text-center text-[12px] text-white/55">
          كل الكروت مخفية. افتح <span className="text-[#FF6B1A]">تخصيص → إضافة كرت</span> لإظهار اللي تحب.
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3">
          {visible.map((id) => {
            const size = layout.sizes[id] ?? CARD_BY_ID[id]?.defaultSize ?? 'md';
            const isDragTarget = overId === id && dragId !== null && dragId !== id;
            return (
              <div
                key={id}
                draggable={editing}
                onDragStart={(e) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => { if (editing && dragId) { e.preventDefault(); setOverId(id); } }}
                onDragLeave={() => setOverId((cur) => (cur === id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) reorder(dragId, id);
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                className={
                  cardSpanClass(size) +
                  ' relative transition-[opacity,transform] ' +
                  (editing ? ' cursor-grab ' : '') +
                  (dragId === id ? ' opacity-40 ' : '') +
                  (isDragTarget ? ' rounded-xl ring-2 ring-[#FF6B1A]/60 ring-offset-2 ring-offset-[#0F0F12] ' : '')
                }
              >
                {editing && (
                  <div className="absolute end-2 top-2 z-20 flex items-center gap-0.5 rounded-md border border-white/[0.1] bg-[#0F0F12]/90 p-0.5 backdrop-blur">
                    <span className="grid h-6 w-6 place-items-center text-white/40"><GripVertical size={12} /></span>
                    <button type="button" onClick={() => bump(id, -1)} title="حرّك لأعلى" className="grid h-6 w-6 place-items-center rounded text-white/55 hover:bg-white/[0.08] hover:text-white">
                      <ChevronUp size={12} />
                    </button>
                    <button type="button" onClick={() => bump(id, 1)} title="حرّك لأسفل" className="grid h-6 w-6 place-items-center rounded text-white/55 hover:bg-white/[0.08] hover:text-white">
                      <ChevronDown size={12} />
                    </button>
                    <button type="button" onClick={() => cycleSize(id)} title="غيّر الحجم" className="inline-flex h-6 min-w-6 items-center gap-1 rounded px-1.5 text-white/65 hover:bg-white/[0.08] hover:text-white">
                      <Maximize2 size={11} />
                      <span className="font-mono text-[9px]">{SIZE_LABEL[size]}</span>
                    </button>
                    <button type="button" onClick={() => hide(id)} title="إخفاء" className="grid h-6 w-6 place-items-center rounded text-white/55 hover:bg-[#FF6B1A]/15 hover:text-[#FF6B1A]">
                      <EyeOff size={12} />
                    </button>
                  </div>
                )}
                {nodeById.get(id)}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
