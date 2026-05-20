import type { ReactNode } from 'react';

/**
 * Smart card used inside a 12-col responsive grid. Same look as the
 * dashboard's "اللوحة" cards so every page feels unified.
 */
export function DashCard({
  span = 4,
  title,
  badge,
  tone,
  link,
  children,
}: {
  span?: number;
  title: string;
  badge?: string;
  tone?: 'success' | 'warning' | 'danger' | 'info';
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  const badgeColor =
    tone === 'success' ? 'var(--success)'
      : tone === 'warning' ? 'var(--warning)'
        : tone === 'danger' ? 'var(--danger)'
          : tone === 'info' ? 'var(--info)'
            : 'var(--text-muted)';
  return (
    <div
      data-span={span}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <h3 className="text-[12px] font-semibold text-[var(--text)]">{title}</h3>
        {badge != null && (
          <span
            className="rounded px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: badgeColor + '22', color: badgeColor }}
          >
            {badge}
          </span>
        )}
        {link && (
          <a
            href={link.href}
            className="ms-auto text-[10px] text-[var(--accent)] hover:underline"
          >
            {link.label} →
          </a>
        )}
        <span
          className="cursor-grab text-[var(--text-dim)]"
          style={link ? {} : { marginInlineStart: 'auto' }}
          title="إعادة ترتيب"
        >
          ⋮⋮
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * Numeric mini-card, used alongside DashCard for quick KPI tiles.
 */
export function MiniStat({
  span = 3,
  label,
  value,
  sub,
  href,
  tone = 'default',
}: {
  span?: number;
  label: string;
  value: ReactNode;
  sub?: string;
  href?: string;
  tone?: 'default' | 'warning' | 'danger' | 'accent' | 'success';
}) {
  const color =
    tone === 'accent' ? 'var(--accent)'
      : tone === 'warning' ? 'var(--warning)'
        : tone === 'danger' ? 'var(--danger)'
          : tone === 'success' ? 'var(--success)'
            : 'var(--text)';
  const inner = (
    <>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p
        className="mt-1 text-[24px] font-bold leading-none tracking-[-0.018em] tabular"
        style={{ color, fontFamily: 'var(--font-display)' }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px] text-[var(--text-dim)]">{sub}</p>}
    </>
  );
  const cls =
    'block rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 ' +
    (href ? 'magnet hover:border-[var(--line-strong)]' : '');
  if (href) {
    return (
      <a href={href} data-span={span} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <div data-span={span} className={cls}>
      {inner}
    </div>
  );
}

/**
 * The wrapping grid that DashCard/MiniStat live inside.
 * 12-col on desktop, 6-col on tablet, 1-col on phone.
 */
export function CardsGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <>
      <style>{`
        .cards-grid { display: grid; gap: 12px; grid-template-columns: repeat(12, 1fr); }
        .cards-grid > [data-span="12"] { grid-column: span 12; }
        .cards-grid > [data-span="8"]  { grid-column: span 8; }
        .cards-grid > [data-span="6"]  { grid-column: span 6; }
        .cards-grid > [data-span="4"]  { grid-column: span 4; }
        .cards-grid > [data-span="3"]  { grid-column: span 3; }
        @media (max-width: 1100px) {
          .cards-grid { grid-template-columns: repeat(6, 1fr); }
          .cards-grid > [data-span="8"], .cards-grid > [data-span="6"] { grid-column: span 6; }
          .cards-grid > [data-span="4"], .cards-grid > [data-span="3"] { grid-column: span 3; }
        }
        @media (max-width: 720px) {
          .cards-grid { grid-template-columns: 1fr; }
          .cards-grid > * { grid-column: span 1 !important; }
        }
      `}</style>
      <div className={'cards-grid ' + (className ?? '')}>{children}</div>
    </>
  );
}
