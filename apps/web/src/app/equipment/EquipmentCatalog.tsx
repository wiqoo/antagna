'use client';

import Link from 'next/link';
import { Battery, Camera, Plus } from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';

export interface EquipmentRow {
  id: string;
  code: string;
  category: string;
  manufacturer: string | null;
  model: string;
  serialNumber: string | null;
  status: string;
  currentLocation: string | null;
  insuranceValueSar: string | number | null;
  requiresCharging: boolean | null;
  photoUrl: string | null;
  groupNameAr: string | null;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  available: 'success',
  checked_out: 'warning',
  repair: 'danger',
  lost: 'danger',
  retired: 'neutral',
};

const STATUS_LABEL_AR: Record<string, string> = {
  available: 'متاح',
  checked_out: 'في الموقع',
  repair: 'صيانة',
  lost: 'مفقود',
  retired: 'متقاعد',
};

function fmtSar(v: string | number | null): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

function modelLine(it: EquipmentRow): string {
  return [it.manufacturer, it.model].filter(Boolean).join(' ');
}

export function EquipmentCatalog({
  items,
  initialFilters,
}: {
  items: EquipmentRow[];
  initialFilters?: Record<string, string>;
}) {
  // Build filter option lists from the actual data (deduped, sorted).
  const statuses = Array.from(new Set(items.map((i) => i.status))).filter(Boolean);
  const categories = Array.from(new Set(items.map((i) => i.category)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ar'));
  const locations = Array.from(
    new Set(items.map((i) => i.currentLocation).filter((l): l is string => !!l)),
  ).sort((a, b) => a.localeCompare(b, 'ar'));

  const allFilters: FilterDef<EquipmentRow>[] = [
    {
      key: 'status',
      label: 'الحالة',
      options: statuses.map((s) => ({ value: s, label: STATUS_LABEL_AR[s] ?? s })),
      predicate: (row, value) => row.status === value,
    },
    {
      key: 'category',
      label: 'الفئة',
      options: categories.map((c) => ({ value: c, label: c })),
      predicate: (row, value) => row.category === value,
    },
    {
      key: 'location',
      label: 'الموقع',
      options: locations.map((l) => ({ value: l, label: l })),
      predicate: (row, value) => row.currentLocation === value,
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const columns: ColumnDef<EquipmentRow>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      sortValue: (r) => r.code,
      cell: (r) => (
        <Link
          href={`/equipment/${r.id}`}
          className="font-mono text-[11px] text-[var(--text-dim)] hover:text-[var(--accent)]"
        >
          {r.code}
        </Link>
      ),
    },
    {
      key: 'model',
      header: 'Model',
      sortable: true,
      sortValue: (r) => modelLine(r),
      cell: (r) => (
        <Link href={`/equipment/${r.id}`} className="group block">
          <span className="text-[13px] text-[var(--text)] group-hover:text-[var(--accent)]">
            {r.manufacturer && (
              <span className="text-[var(--text-dim)]">{r.manufacturer} </span>
            )}
            {r.model}
          </span>
          {r.requiresCharging && (
            <Battery size={11} className="ms-2 inline text-[var(--text-dim)]" />
          )}
        </Link>
      ),
    },
    {
      key: 'serial',
      header: 'Serial',
      sortable: true,
      sortValue: (r) => r.serialNumber ?? '',
      cell: (r) => (
        <span className="font-mono text-[11px] text-[var(--text-dim)]">
          {r.serialNumber ?? '—'}
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      sortable: true,
      sortValue: (r) => r.currentLocation ?? '',
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">
          {r.currentLocation ?? '—'}
        </span>
      ),
    },
    {
      key: 'insurance',
      header: 'Insurance',
      sortable: true,
      sortValue: (r) => Number(r.insuranceValueSar ?? 0),
      cell: (r) => {
        const s = fmtSar(r.insuranceValueSar);
        return s === '—' ? (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ) : (
          <span className="text-[12px] text-[var(--text-muted)] tabular">
            {s}{' '}
            <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              SAR
            </span>
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (r) => STATUS_LABEL_AR[r.status] ?? r.status,
      cell: (r) => (
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
      ),
    },
  ];

  const renderCard = (r: EquipmentRow) => (
    <Link
      href={`/equipment/${r.id}`}
      className="magnet group block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] transition-colors hover:border-[var(--line-strong)]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--surface)]">
        {r.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.photoUrl}
            alt={modelLine(r) || r.code}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--text-dim)]">
            <Camera size={28} />
          </div>
        )}
        <div className="absolute top-2 end-2">
          <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
            {STATUS_LABEL_AR[r.status] ?? r.status}
          </StatusPill>
        </div>
        {r.requiresCharging && (
          <div className="absolute bottom-2 start-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
            <Battery size={13} />
          </div>
        )}
      </div>
      <div className="p-3.5">
        <p className="font-mono text-[10px] text-[var(--text-dim)]">{r.code}</p>
        <p className="mt-1 truncate text-[13px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
          {r.manufacturer && (
            <span className="text-[var(--text-dim)]">{r.manufacturer} </span>
          )}
          {r.model}
        </p>
        <p className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span className="truncate">{r.currentLocation ?? '—'}</span>
          <span className="ms-2 shrink-0 uppercase tracking-[0.16em] text-[var(--text-dim)]">
            {r.category}
          </span>
        </p>
      </div>
    </Link>
  );

  const renderCompact = (r: EquipmentRow) => (
    <Link
      href={`/equipment/${r.id}`}
      className="flex items-center gap-3 text-[13px] hover:text-[var(--accent)]"
    >
      <span className="w-24 shrink-0 truncate font-mono text-[10px] text-[var(--text-dim)]">
        {r.code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">
        {r.manufacturer && (
          <span className="text-[var(--text-dim)]">{r.manufacturer} </span>
        )}
        {r.model}
        {r.requiresCharging && (
          <Battery size={10} className="ms-1.5 inline text-[var(--text-dim)]" />
        )}
      </span>
      <span className="hidden w-28 shrink-0 truncate text-[11px] text-[var(--text-muted)] sm:inline">
        {r.currentLocation ?? '—'}
      </span>
      <span className="shrink-0">
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
      </span>
    </Link>
  );

  return (
    <ListWorkspace<EquipmentRow>
      rows={items}
      storageKey="equipment"
      getId={(r) => r.id}
      searchText={(r) =>
        [r.code, r.manufacturer, r.model, r.serialNumber, r.currentLocation, r.category]
          .filter(Boolean)
          .join(' ')
      }
      filters={filters}
      columns={columns}
      renderCard={renderCard}
      renderCompact={renderCompact}
      defaultView="table"
      initialFilters={initialFilters}
      emptyState={
        <EmptyState
          icon={<Camera size={18} />}
          title="لا نتائج"
          description="جرّب تعديل البحث أو الفلاتر، أو أضف معدّة جديدة."
          action={
            <Link
              href="/equipment/new"
              className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus size={14} />
              إضافة معدّة
            </Link>
          }
        />
      }
    />
  );
}
