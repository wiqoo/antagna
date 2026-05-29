'use client';

import {
  ListWorkspace,
  StatusPill,
  MoneyDisplay,
  EmptyState,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';
import { Megaphone } from 'lucide-react';
import {
  DEAL_TYPE_LABEL_AR,
  DEAL_STATUS_LABEL_AR,
  DEAL_STATUS_TONE,
} from './_shared';
import { updateDealStatus } from './actions';

export interface DealRow {
  id: string;
  code: string;
  dealType: string;
  status: string;
  contractValueSar: number | null;
  deliverablesCount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  accountHandle: string;
  ownerLabel: string;
  sponsorClientName: string | null;
}

const NEXT_STATUS: Record<string, string | null> = {
  draft: 'agreed',
  agreed: 'in_progress',
  in_progress: 'completed',
  completed: null,
  cancelled: null,
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function DealsWorkspace({ rows, canEdit }: { rows: DealRow[]; canEdit: boolean }) {
  const types = Array.from(new Set(rows.map((r) => r.dealType))).filter(Boolean);
  const statuses = Array.from(new Set(rows.map((r) => r.status))).filter(Boolean);

  const allFilters: FilterDef<DealRow>[] = [
    {
      key: 'status',
      label: 'الحالة',
      options: statuses.map((s) => ({ value: s, label: DEAL_STATUS_LABEL_AR[s] ?? s })),
      predicate: (row, v) => row.status === v,
    },
    {
      key: 'type',
      label: 'النوع',
      options: types.map((tp) => ({ value: tp, label: DEAL_TYPE_LABEL_AR[tp] ?? tp })),
      predicate: (row, v) => row.dealType === v,
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const StatusCell = ({ r }: { r: DealRow }) => {
    const next = NEXT_STATUS[r.status];
    return (
      <div className="flex items-center gap-2">
        <StatusPill tone={DEAL_STATUS_TONE[r.status] ?? 'neutral'}>
          {DEAL_STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
        {canEdit && next && (
          <form action={updateDealStatus}>
            <input type="hidden" name="dealId" value={r.id} />
            <input type="hidden" name="status" value={next} />
            <button
              type="submit"
              className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              title={`نقل إلى: ${DEAL_STATUS_LABEL_AR[next] ?? next}`}
            >
              → {DEAL_STATUS_LABEL_AR[next] ?? next}
            </button>
          </form>
        )}
      </div>
    );
  };

  const columns: ColumnDef<DealRow>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      sortValue: (r) => r.code,
      cell: (r) => <span className="font-mono text-[11px] text-[var(--text-dim)]">{r.code}</span>,
    },
    {
      key: 'account',
      header: 'الحساب',
      sortable: true,
      sortValue: (r) => r.accountHandle,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] text-[var(--text)]">@{r.accountHandle}</p>
          <p className="truncate text-[11px] text-[var(--text-muted)]">{r.ownerLabel}</p>
        </div>
      ),
    },
    {
      key: 'sponsor',
      header: 'الراعي',
      sortable: true,
      sortValue: (r) => r.sponsorClientName ?? '',
      cell: (r) => <span className="text-[12px] text-[var(--text-muted)]">{r.sponsorClientName ?? '—'}</span>,
    },
    {
      key: 'type',
      header: 'النوع',
      sortable: true,
      sortValue: (r) => r.dealType,
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">{DEAL_TYPE_LABEL_AR[r.dealType] ?? r.dealType}</span>
      ),
    },
    {
      key: 'value',
      header: 'القيمة',
      sortable: true,
      sortValue: (r) => r.contractValueSar ?? 0,
      cell: (r) =>
        r.contractValueSar ? (
          <MoneyDisplay amount={Number(r.contractValueSar)} currency="SAR" className="text-[12px]" />
        ) : (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ),
    },
    {
      key: 'window',
      header: 'الفترة',
      sortable: true,
      sortValue: (r) => r.startsAt ?? '',
      cell: (r) => (
        <span className="font-mono text-[11px] text-[var(--text-dim)]" dir="ltr">
          {fmtDate(r.startsAt)} → {fmtDate(r.endsAt)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      sortable: true,
      sortValue: (r) => DEAL_STATUS_LABEL_AR[r.status] ?? r.status,
      cell: (r) => <StatusCell r={r} />,
    },
  ];

  const renderCard = (r: DealRow) => (
    <article className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] text-[var(--text-dim)]">{r.code}</p>
          <p className="truncate text-[13px] font-medium text-[var(--text)]">@{r.accountHandle}</p>
          <p className="truncate text-[11px] text-[var(--text-muted)]">
            {r.sponsorClientName ?? r.ownerLabel}
          </p>
        </div>
        {r.contractValueSar ? (
          <MoneyDisplay amount={Number(r.contractValueSar)} currency="SAR" className="text-[13px]" />
        ) : null}
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)]">
        <span>{DEAL_TYPE_LABEL_AR[r.dealType] ?? r.dealType}</span>
        {r.deliverablesCount != null && <span>{r.deliverablesCount} تسليم</span>}
      </div>
      <StatusCell r={r} />
    </article>
  );

  return (
    <ListWorkspace<DealRow>
      rows={rows}
      storageKey="social-deals"
      getId={(r) => r.id}
      searchText={(r) =>
        [r.code, r.accountHandle, r.ownerLabel, r.sponsorClientName, r.dealType].filter(Boolean).join(' ')
      }
      filters={filters}
      columns={columns}
      renderCard={renderCard}
      defaultView="table"
      emptyState={
        <EmptyState
          icon={<Megaphone size={18} />}
          title="لا توجد صفقات"
          description="سجّل صفقات الرعاية لتتبّع الإيراد الإعلاني (التحصيل يبقى في دفترة، D-022)."
        />
      }
    />
  );
}
