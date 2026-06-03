'use client';

/**
 * Project-Manager board cards — reusable, data-driven widgets that match the V5
 * card shell. Three flexible shapes cover the whole PM board (list / stat-strip
 * / funnel); each card in board.tsx feeds one of them its computed data. Every
 * card is scoped to the signed-in PM, so the board is genuinely HIS desk.
 */
import Link from 'next/link';
import { Card } from './shell';
import { toAr, type CardSize, type AILevel } from './utils';

type CardProps = { size?: CardSize; editable?: boolean };

type Tone = 'red' | 'amber' | 'green' | 'dim';
const DOT: Record<Tone, string> = {
  red: '#FF6B1A',
  amber: 'rgba(255,255,255,0.62)',
  green: 'rgba(120,200,150,0.75)',
  dim: 'rgba(255,255,255,0.32)',
};
const METRIC_TEXT: Record<Tone, string> = {
  red: 'text-[#FF8442]',
  amber: 'text-white/65',
  green: 'text-[rgba(120,200,150,0.85)]',
  dim: 'text-white/45',
};

function MaybeLink({ href, className, children }: { href?: string; className?: string; children: React.ReactNode }) {
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <span className={className}>{children}</span>;
}

// ── List card ────────────────────────────────────────────────────────────────
export type PmRow = {
  primary: string;
  secondary?: string;
  metric?: string;   // right-aligned (age / value / count)
  tone?: Tone;       // dot + metric color
  href?: string;
};
export type PmListData = {
  title: string;      // mono eyebrow, e.g. "// my_approvals"
  ai?: AILevel;
  footer?: string;
  empty?: string;
  items: PmRow[];
};

const SAMPLE_LIST: PmListData = { title: '// pm_list', items: [], empty: '—' };

export function CardPmList({ size = 'md', editable, data }: CardProps & { data?: PmListData }) {
  const d = data ?? SAMPLE_LIST;
  return (
    <Card title={d.title} ai={d.ai} size={size} editable={editable}
      footer={d.footer ? <span>{d.footer}</span> : undefined}>
      {d.items.length === 0 ? (
        <p className="py-2 text-[11px] text-white/45">{d.empty ?? 'لا يوجد'}</p>
      ) : (
        <ul className="space-y-2">
          {d.items.map((it, i) => (
            <li key={i} className="grid grid-cols-[8px_1fr_auto] items-center gap-2.5 text-[11.5px]">
              <span className="h-2 w-2 rounded-full" style={{ background: DOT[it.tone ?? 'dim'] }} />
              <MaybeLink href={it.href} className="min-w-0">
                <span className="block truncate text-white hover:text-[#FF6B1A]">{it.primary}</span>
                {it.secondary && <span className="block truncate text-[10px] text-white/50">{it.secondary}</span>}
              </MaybeLink>
              {it.metric && (
                <span className={`shrink-0 text-end font-mono text-[10px] ${METRIC_TEXT[it.tone ?? 'dim']}`}>{it.metric}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Stat-strip card ──────────────────────────────────────────────────────────
export type PmStat = { label: string; value: string; sub?: string; tone?: Tone; href?: string };
export type PmStatsData = {
  title: string;
  ai?: AILevel;
  footer?: string;
  stats: PmStat[];
};

const SAMPLE_STATS: PmStatsData = { title: '// pm_stats', stats: [] };

export function CardPmStats({ size = 'sm', editable, data }: CardProps & { data?: PmStatsData }) {
  const d = data ?? SAMPLE_STATS;
  const cols = Math.min(Math.max(d.stats.length, 1), 4);
  return (
    <Card title={d.title} ai={d.ai} size={size} editable={editable}
      footer={d.footer ? <span>{d.footer}</span> : undefined}>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {d.stats.map((s, i) => (
          <MaybeLink key={i} href={s.href} className="block rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 hover:border-white/[0.14]">
            <div className={`font-mono text-[20px] font-semibold leading-none ${s.tone ? METRIC_TEXT[s.tone] : 'text-white'}`}>{s.value}</div>
            <div className="mt-1 truncate text-[10px] text-white/55">{s.label}</div>
            {s.sub && <div className="mt-0.5 truncate text-[9px] text-white/35">{s.sub}</div>}
          </MaybeLink>
        ))}
      </div>
    </Card>
  );
}

// ── Funnel card (pipeline) ───────────────────────────────────────────────────
export type PmFunnelStage = { label: string; count: number; value?: string };
export type PmFunnelKpi = { label: string; value: string; target: string; status: 'green' | 'amber' | 'red' | 'na' };
export type PmFunnelData = {
  title: string;
  ai?: AILevel;
  footer?: string;
  stages: PmFunnelStage[];
  kpis: PmFunnelKpi[];
};

const KPI_TONE: Record<PmFunnelKpi['status'], string> = {
  green: 'text-[rgba(120,200,150,0.9)]', amber: 'text-white/70', red: 'text-[#FF8442]', na: 'text-white/40',
};

const SAMPLE_FUNNEL: PmFunnelData = { title: '// pipeline', stages: [], kpis: [] };

export function CardPmFunnel({ size = 'lg', editable, data }: CardProps & { data?: PmFunnelData }) {
  const d = data ?? SAMPLE_FUNNEL;
  const max = Math.max(1, ...d.stages.map((s) => s.count));
  return (
    <Card title={d.title} ai={d.ai} size={size} editable={editable}
      footer={d.footer ? <span>{d.footer}</span> : undefined}>
      <div className="space-y-1.5">
        {d.stages.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className="w-20 shrink-0 truncate text-white/60">{s.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-white/[0.04]">
              <div className="h-full rounded bg-[#FF6B1A]/60" style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
            <span className="w-7 shrink-0 text-end font-mono text-white">{toAr(s.count)}</span>
            {s.value && <span className="w-14 shrink-0 text-end font-mono text-[9px] text-white/40">{s.value}</span>}
          </div>
        ))}
      </div>
      {d.kpis.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.05] pt-2.5">
          {d.kpis.map((k, i) => (
            <span key={i} className="inline-flex items-baseline gap-1 text-[10px]">
              <span className="text-white/50">{k.label}</span>
              <span className={`font-mono font-semibold ${KPI_TONE[k.status]}`}>{k.value}</span>
              <span className="text-white/30">/{k.target}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
