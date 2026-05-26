'use client';

/**
 * V5 card shell — the bordered box, AI stripe, header, footer.
 *
 * Two skins, selected via `CardSkin` context (default = mono):
 *   - 'mono'  : the original V5 look — `// snake_case` monospace eyebrow.
 *   - 'clean' : V6 look — a clean Arabic title in the display font, higher
 *               contrast, and a hover quick-action slot. Set per-card by
 *               wrapping the card in <CardSkin variant="clean" title=… actions=…>.
 *
 * The grid *cell* owns the column span (see `Cell` + `cardSpanClass`) so
 * size-cycling can be optimistic client-side. Card is `h-full`.
 */
import { createContext, useContext } from 'react';
import { Sparkles, MoreHorizontal, GripVertical } from 'lucide-react';
import type { AILevel, CardSize } from './utils';

export type CardSkinValue = {
  variant: 'mono' | 'clean';
  /** Clean-skin Arabic title override (replaces the // code eyebrow). */
  title?: string;
  /** Quick actions revealed on hover in the clean header. */
  actions?: React.ReactNode;
};

const CardSkinContext = createContext<CardSkinValue>({ variant: 'mono' });

/** Wrap a card to give it the clean V6 skin + a human title + quick actions. */
export function CardSkin({
  variant = 'clean', title, actions, children,
}: CardSkinValue & { children: React.ReactNode }) {
  return (
    <CardSkinContext.Provider value={{ variant, title, actions }}>
      {children}
    </CardSkinContext.Provider>
  );
}

export function Card({
  title,
  ai,
  children,
  footer,
  editable = false,
}: {
  title: string;
  ai?: AILevel;
  size?: CardSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  editable?: boolean;
}) {
  const skin = useContext(CardSkinContext);
  const clean = skin.variant === 'clean';
  const cleanTitle = skin.title ?? title.replace(/^\/\/\s*/, '').replace(/_/g, ' ');

  return (
    <article
      className={
        'group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#17171C] transition-colors hover:border-white/[0.16] ' +
        (clean ? 'card-clean' : '')
      }
    >
      {/* AI stripe — top edge */}
      {ai && ai !== 'none' && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              ai === 'heavy' ? '#FF6B1A'
                : ai === 'medium' ? 'rgba(255,107,26,0.6)'
                  : 'rgba(255,107,26,0.3)',
          }}
        />
      )}

      {clean ? (
        <header className="flex items-center gap-2 px-4 pt-3 pb-2.5">
          {ai && ai !== 'none' && <AIBadge level={ai} />}
          <h3
            className="truncate text-[14px] font-semibold tracking-[-0.01em] text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {cleanTitle}
          </h3>
          {skin.actions && (
            <div className="ms-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {skin.actions}
            </div>
          )}
        </header>
      ) : (
        <header className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
            {title}
          </h3>
          {ai && ai !== 'none' && <AIBadge level={ai} />}
          {editable && (
            <div className="ms-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button className="grid h-5 w-5 cursor-grab place-items-center rounded text-white/35 hover:bg-white/[0.06] hover:text-white">
                <GripVertical size={11} />
              </button>
              <button className="grid h-5 w-5 place-items-center rounded text-white/35 hover:bg-white/[0.06] hover:text-white">
                <MoreHorizontal size={11} />
              </button>
            </div>
          )}
        </header>
      )}

      <div className="flex-1 px-4 pb-3">{children}</div>

      {footer && (
        <footer className="flex items-center gap-2 border-t border-white/[0.05] px-4 py-2 font-mono text-[9.5px] text-white/40">
          {footer}
        </footer>
      )}
    </article>
  );
}

export function AIBadge({ level }: { level: Exclude<AILevel, 'none'> }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-wider"
      style={{
        background:
          level === 'heavy' ? 'rgba(255,107,26,0.18)'
            : level === 'medium' ? 'rgba(255,107,26,0.10)'
              : 'rgba(255,107,26,0.06)',
        color:
          level === 'heavy' ? '#FF8442'
            : level === 'medium' ? '#FF6B1A'
              : 'rgba(255,107,26,0.7)',
      }}
    >
      <Sparkles size={8} />
      AI
    </span>
  );
}
