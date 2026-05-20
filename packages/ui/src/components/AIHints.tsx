import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

export type AIHint = {
  /** Optional numeric label like "01" / "02" */
  index?: string;
  /** One-line summary of the suggestion */
  text: string;
  /** Why Claude flagged this — shown as a smaller subtitle */
  insight?: string;
  /** Whether this is urgent — affects styling */
  urgent?: boolean;
  /** Inline action buttons. AI suggests; user decides. */
  actions?: Array<{
    label: string;
    href?: string;
    primary?: boolean;
    /** Server action or onClick — caller decides */
    onClick?: () => void;
  }>;
};

/**
 * AI suggestion strip — used at the top of every page where Claude
 * surfaces context-relevant suggestions. Critically: AI ALWAYS proposes,
 * the user always decides. Buttons confirm an AI proposal, never
 * auto-execute on page load.
 */
export function AIHints({
  context,
  headline,
  summary,
  hints,
  compact = false,
  updatedAt,
}: {
  /** Tiny eyebrow chip — e.g. "Antagna AI · لوحة التحكم" */
  context: string;
  /** Big headline — e.g. "صباح الخير محمد — ٣ أولويات" */
  headline?: ReactNode;
  /** One line under the headline */
  summary?: ReactNode;
  /** Suggestion list */
  hints: AIHint[];
  /** Smaller variant for in-page placement */
  compact?: boolean;
  /** "محدّث منذ ٣ دقائق" */
  updatedAt?: string;
}) {
  if (hints.length === 0 && !headline) return null;

  return (
    <section
      className={
        'ai-strip ' +
        (compact ? 'p-4 md:p-5' : 'p-5 md:p-6')
      }
    >
      {/* Eyebrow */}
      <div className="mb-3 flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.06em]">
        <span
          className="inline-flex items-center gap-1.5 rounded px-2 py-1"
          style={{
            background: 'var(--accent-tint)',
            color: 'var(--accent)',
          }}
        >
          <Sparkles size={10} strokeWidth={2} />
          {context}
        </span>
        {updatedAt && (
          <span className="text-[10px] font-normal tracking-normal text-[var(--text-dim)] normal-case">
            {updatedAt}
          </span>
        )}
      </div>

      {/* Headline */}
      {headline && (
        <h2
          className={
            'leading-[1.2] tracking-[-0.018em] text-[var(--text)] ' +
            (compact ? 'text-[20px] font-bold md:text-[22px]' : 'text-[26px] font-bold md:text-[32px]')
          }
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {headline}
        </h2>
      )}

      {summary && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
          {summary}
        </p>
      )}

      {/* Hints list */}
      {hints.length > 0 && (
        <ol className="mt-4 list-none space-y-0 p-0">
          {hints.map((h, i) => (
            <li
              key={i}
              className={
                'grid grid-cols-[32px_1fr] gap-3 py-3 ' +
                (i > 0 ? 'border-t border-[var(--line)]' : '')
              }
            >
              <span
                className={
                  'pt-0.5 font-mono text-[14px] font-bold ' +
                  (h.urgent ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]')
                }
              >
                {h.index ?? String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-[14px] font-semibold leading-snug text-[var(--text)]">
                  {h.text}
                </p>
                {h.insight && (
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                    ↳ {h.insight}
                  </p>
                )}
                {h.actions && h.actions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {h.actions.map((a, j) => {
                      const cls = a.primary
                        ? 'inline-flex h-7 items-center rounded-md px-3 text-[11px] font-semibold text-white'
                        : 'inline-flex h-7 items-center rounded-md border border-[var(--line)] bg-transparent px-3 text-[11px] font-medium text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]';
                      const style = a.primary
                        ? h.urgent
                          ? { background: 'var(--accent)' }
                          : { background: 'var(--surface-hover)', color: 'var(--text)' }
                        : undefined;
                      if (a.href) {
                        return (
                          <a key={j} href={a.href} className={cls} style={style}>
                            {a.label}
                          </a>
                        );
                      }
                      return (
                        <button
                          key={j}
                          type="button"
                          onClick={a.onClick}
                          className={cls}
                          style={style}
                        >
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
