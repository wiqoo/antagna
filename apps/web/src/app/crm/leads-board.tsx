'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { StatusPill } from '@antagna/ui';
import { updateLeadStatus } from './actions';

export type LeadRow = {
  id: string;
  code: string;
  status: string;
  source: string | null;
  unmatchedFromEmail: string | null;
  unmatchedFromName: string | null;
  estimatedValue: string | number | null;
  receivedAt: Date | string;
  temperatureScore: number | null;
  clientNameAr: string | null;
  assignedName: string | null;
};

type Tone = 'info' | 'accent' | 'warning' | 'success' | 'neutral' | 'danger';

const FUNNEL = ['new', 'qualified', 'nurturing', 'proposal_sent', 'won'] as const;
const ALL_STATUSES = [
  'new',
  'qualified',
  'nurturing',
  'proposal_sent',
  'won',
  'lost',
  'ghosted',
];
const LABEL: Record<string, string> = {
  new: 'جديد',
  qualified: 'مؤهّل',
  nurturing: 'رعاية',
  proposal_sent: 'عرض مُرسَل',
  won: 'مكسوب',
  lost: 'مفقود',
  ghosted: 'متجاهَل',
};
const TONE: Record<string, Tone> = {
  new: 'info',
  qualified: 'accent',
  nurturing: 'warning',
  proposal_sent: 'warning',
  won: 'success',
};

export function LeadsBoard({ rows }: { rows: LeadRow[] }) {
  const byStatus = new Map<string, LeadRow[]>();
  for (const s of FUNNEL) byStatus.set(s, []);
  for (const r of rows) {
    if (byStatus.has(r.status)) byStatus.get(r.status)!.push(r);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {FUNNEL.map((status) => {
        const items = byStatus.get(status) ?? [];
        return (
          <div key={status} className="flex w-[272px] shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <StatusPill tone={TONE[status] ?? 'neutral'} withDot={false}>
                {LABEL[status]}
              </StatusPill>
              <span className="font-mono text-[11px] text-[var(--text-dim)]">
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((l) => (
                <LeadCard key={l.id} lead={l} />
              ))}
              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-[var(--line)] py-4 text-center text-[11px] text-[var(--text-dim)]">
                  —
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadCard({ lead }: { lead: LeadRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const name =
    lead.clientNameAr ?? lead.unmatchedFromName ?? lead.unmatchedFromEmail ?? '—';
  const ageDays = Math.floor(
    (Date.now() - new Date(lead.receivedAt).getTime()) / 86_400_000,
  );

  const move = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === lead.status) return;
    start(async () => {
      await updateLeadStatus(lead.id, next);
      router.refresh();
    });
  };

  return (
    <div
      className={
        'rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition-opacity ' +
        (pending ? 'opacity-50' : '')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--text)]">
          {name}
        </p>
        {lead.temperatureScore != null && (
          <span className="shrink-0 font-mono text-[10px] text-[var(--text-dim)]">
            {lead.temperatureScore}°
          </span>
        )}
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
        <span className="font-mono text-[10px] text-[var(--text-dim)]">{lead.code}</span>
        {lead.source && <span className="truncate">· {lead.source}</span>}
      </p>
      {lead.temperatureScore != null && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
          <div
            className="h-full bg-gradient-to-r from-blue-400 via-orange-400 to-red-500"
            style={{ width: `${lead.temperatureScore}%` }}
          />
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-[var(--text-muted)]">
          {lead.assignedName ?? 'دون مسؤول'}
          {lead.estimatedValue
            ? ` · ${Number(lead.estimatedValue).toLocaleString('en-US')} ر.س`
            : ''}
        </span>
        <span className="shrink-0 text-[10px] text-[var(--text-dim)]">{ageDays}ي</span>
      </div>
      <select
        value={lead.status}
        onChange={move}
        disabled={pending}
        aria-label="نقل الحالة"
        className="mt-2.5 h-7 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LABEL[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
