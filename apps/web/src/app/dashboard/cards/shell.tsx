/**
 * V5 card shell — the bordered box, AI stripe, header, footer.
 *
 * NOTE vs the original preview/lab/v5 source: the `Card` no longer applies
 * its own `col-span`. The grid *cell* owns the column span now (see `Cell`
 * + `cardSpanClass`) so size-cycling can be done optimistically client-side
 * without re-rendering the server card. Card is `h-full` and fills its cell.
 */
import { Sparkles, MoreHorizontal, GripVertical } from 'lucide-react';

export type CardSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type AILevel = 'heavy' | 'medium' | 'light' | 'none';

export const CARD_SIZES: CardSize[] = ['sm', 'md', 'lg', 'xl', 'full'];

/** 12-col span per size. `Cell` and the dashboard grid apply this. */
export function cardSpanClass(size: CardSize): string {
  return {
    sm: 'col-span-12 md:col-span-3',
    md: 'col-span-12 md:col-span-4',
    lg: 'col-span-12 md:col-span-6',
    xl: 'col-span-12 md:col-span-8',
    full: 'col-span-12',
  }[size];
}

/** Convert Western digits to Arabic-Indic to match the V5 aesthetic. */
export function toAr(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.charAt(Number(d)));
}

/** Static span wrapper — used by the preview labs (no interactive grid). */
export function Cell({ size = 'md', children }: { size?: CardSize; children: React.ReactNode }) {
  return <div className={cardSpanClass(size)}>{children}</div>;
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
  /** Accepted for API compatibility with the preview labs; span is owned by the cell. */
  size?: CardSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  editable?: boolean;
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#17171C] transition-colors hover:border-white/[0.16]">
      {/* AI stripe — top edge, very subtle */}
      {ai && ai !== 'none' && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              ai === 'heavy'
                ? '#FF6B1A'
                : ai === 'medium'
                  ? 'rgba(255,107,26,0.6)'
                  : 'rgba(255,107,26,0.3)',
          }}
        />
      )}

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
          level === 'heavy'
            ? 'rgba(255,107,26,0.18)'
            : level === 'medium'
              ? 'rgba(255,107,26,0.10)'
              : 'rgba(255,107,26,0.06)',
        color:
          level === 'heavy'
            ? '#FF8442'
            : level === 'medium'
              ? '#FF6B1A'
              : 'rgba(255,107,26,0.7)',
      }}
    >
      <Sparkles size={8} />
      AI
    </span>
  );
}
