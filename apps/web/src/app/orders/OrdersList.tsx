'use client';

import Link from 'next/link';
import { Plus, ShoppingCart, Package } from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';

export interface OrderRow {
  id: string;
  code: string;
  vendorName: string;
  status: string;
  totalSar: string | number | null;
  currency: string;
  orderedAt: string | null;
  expectedAt: string | null;
  receivedAt: string | null;
  itemCount: number;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  draft: 'neutral',
  sent: 'info',
  received: 'success',
  cancelled: 'danger',
};

export const STATUS_LABEL_AR: Record<string, string> = {
  draft: 'مسودّة',
  sent: 'مُرسَل',
  received: 'مُستلَم',
  cancelled: 'ملغى',
};

function fmtSar(v: string | number | null): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

function fmtDate(v: string | null): string {
  if (!v) return '—';
  return new Date(v).toISOString().slice(0, 10);
}

export function OrdersList({
  items,
  initialFilters,
}: {
  items: OrderRow[];
  initialFilters?: Record<string, string>;
}) {
  const statuses = Array.from(new Set(items.map((i) => i.status))).filter(Boolean);
  const vendors = Array.from(new Set(items.map((i) => i.vendorName).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, 'ar'),
  );

  const allFilters: FilterDef<OrderRow>[] = [
    {
      key: 'status',
      label: 'الحالة',
      options: statuses.map((s) => ({ value: s, label: STATUS_LABEL_AR[s] ?? s })),
      predicate: (row, value) => row.status === value,
    },
    {
      key: 'vendor',
      label: 'المورّد',
      options: vendors.map((v) => ({ value: v, label: v })),
      predicate: (row, value) => row.vendorName === value,
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const columns: ColumnDef<OrderRow>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      sortValue: (r) => r.code,
      cell: (r) => (
        <Link
          href={`/orders/${r.id}`}
          className="font-mono text-[11px] text-[var(--text-dim)] hover:text-[var(--accent)]"
        >
          {r.code}
        </Link>
      ),
    },
    {
      key: 'vendor',
      header: 'المورّد',
      sortable: true,
      sortValue: (r) => r.vendorName,
      cell: (r) => (
        <Link href={`/orders/${r.id}`} className="group block">
          <span className="text-[13px] text-[var(--text)] group-hover:text-[var(--accent)]">
            {r.vendorName}
          </span>
        </Link>
      ),
    },
    {
      key: 'items',
      header: 'البنود',
      sortable: true,
      sortValue: (r) => r.itemCount,
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)] tabular">{r.itemCount}</span>
      ),
    },
    {
      key: 'total',
      header: 'الإجمالي',
      sortable: true,
      sortValue: (r) => Number(r.totalSar ?? 0),
      cell: (r) => {
        const s = fmtSar(r.totalSar);
        return s === '—' ? (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ) : (
          <span className="text-[12px] text-[var(--text-muted)] tabular">
            {s}{' '}
            <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              {r.currency}
            </span>
          </span>
        );
      },
    },
    {
      key: 'expected',
      header: 'متوقَّع',
      sortable: true,
      sortValue: (r) => r.expectedAt ?? '',
      cell: (r) => (
        <span className="font-mono text-[11px] text-[var(--text-muted)]">{fmtDate(r.expectedAt)}</span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      sortable: true,
      sortValue: (r) => STATUS_LABEL_AR[r.status] ?? r.status,
      cell: (r) => (
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
      ),
    },
  ];

  const renderCard = (r: OrderRow) => (
    <Link
      href={`/orders/${r.id}`}
      className="magnet group block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4 transition-colors hover:border-[var(--line-strong)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] text-[var(--text-dim)]">{r.code}</p>
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
      </div>
      <p className="mt-2 truncate text-[14px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
        {r.vendorName}
      </p>
      <p className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <Package size={11} className="text-[var(--text-dim)]" /> {r.itemCount} بند
        </span>
        <span className="tabular">
          {fmtSar(r.totalSar)}{' '}
          <span className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
            {r.currency}
          </span>
        </span>
      </p>
    </Link>
  );

  const renderCompact = (r: OrderRow) => (
    <Link
      href={`/orders/${r.id}`}
      className="flex items-center gap-3 text-[13px] hover:text-[var(--accent)]"
    >
      <span className="w-24 shrink-0 truncate font-mono text-[10px] text-[var(--text-dim)]">
        {r.code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">{r.vendorName}</span>
      <span className="hidden w-20 shrink-0 text-end text-[11px] text-[var(--text-muted)] tabular sm:inline">
        {fmtSar(r.totalSar)}
      </span>
      <span className="shrink-0">
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
      </span>
    </Link>
  );

  return (
    <ListWorkspace<OrderRow>
      rows={items}
      storageKey="orders"
      getId={(r) => r.id}
      searchText={(r) => [r.code, r.vendorName, r.status].filter(Boolean).join(' ')}
      filters={filters}
      columns={columns}
      renderCard={renderCard}
      renderCompact={renderCompact}
      defaultView="table"
      initialFilters={initialFilters}
      emptyState={
        <EmptyState
          icon={<ShoppingCart size={18} />}
          title="لا أوامر شراء"
          description="جرّب تعديل البحث أو الفلاتر، أو أنشئ أمر شراء جديد لمورّد."
          action={
            <Link
              href="/orders/new"
              className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus size={14} />
              أمر شراء جديد
            </Link>
          }
        />
      }
    />
  );
}
