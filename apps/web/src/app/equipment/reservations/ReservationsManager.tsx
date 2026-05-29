'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, RotateCcw, XCircle, AlertTriangle, Camera } from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';
import {
  checkoutReservation,
  returnReservation,
  cancelReservation,
} from './actions';

export interface ReservationRow {
  id: string;
  equipmentId: string | null;
  eqCode: string | null;
  eqModel: string | null;
  eqManufacturer: string | null;
  groupNameAr: string | null;
  projectId: string | null;
  projectCode: string | null;
  projectTitle: string | null;
  projectTitleAr: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  reservedByName: string | null;
  /** 'upcoming' | 'active' | 'past' — derived server-side from now(). */
  window: 'upcoming' | 'active' | 'past';
  /** whether the current user may act on this row */
  canCheckout: boolean;
  canReturn: boolean;
  canCancel: boolean;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  reserved: 'info',
  checked_out: 'warning',
  returned: 'success',
  cancelled: 'neutral',
};

const STATUS_LABEL_AR: Record<string, string> = {
  reserved: 'محجوز',
  checked_out: 'مُسلَّم',
  returned: 'مُسترجَع',
  cancelled: 'مُلغى',
};

const WINDOW_LABEL_AR: Record<string, string> = {
  upcoming: 'قادم',
  active: 'جارٍ الآن',
  past: 'منتهٍ',
};

function fmtDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
function fmtTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

function targetLabel(r: ReservationRow): string {
  if (r.eqCode) return [r.eqManufacturer, r.eqModel].filter(Boolean).join(' ') || r.eqCode;
  return r.groupNameAr ? `مجموعة: ${r.groupNameAr}` : '—';
}

const btn =
  'inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-50';
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50';
const dangerBtn =
  'inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--danger)] transition-colors hover:border-[var(--danger)] disabled:opacity-50';

/** Inline row-action cluster (used in every view mode). */
function RowActions({ r }: { r: ReservationRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [notes, setNotes] = useState('');
  const [damaged, setDamaged] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'تعذّر تنفيذ الإجراء');
      else {
        setReturning(false);
        router.refresh();
      }
    });

  const showCheckout = r.status === 'reserved' && r.canCheckout;
  const showReturn = r.status === 'checked_out' && r.canReturn;
  const showCancel = r.status === 'reserved' && r.canCancel;

  if (!showCheckout && !showReturn && !showCancel) {
    return <span className="text-[11px] text-[var(--text-dim)]">—</span>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {showCheckout && (
          <button
            className={primaryBtn}
            disabled={pending}
            onClick={() => run(() => checkoutReservation(r.id, r.equipmentId))}
          >
            <LogIn size={12} /> تسليم
          </button>
        )}
        {showReturn && !returning && (
          <button className={btn} disabled={pending} onClick={() => setReturning(true)}>
            <RotateCcw size={12} /> استرجاع
          </button>
        )}
        {showCancel && (
          <button
            className={dangerBtn}
            disabled={pending}
            onClick={() => {
              if (confirm('إلغاء هذا الحجز؟')) {
                run(() => cancelReservation(r.id, r.equipmentId));
              }
            }}
          >
            <XCircle size={12} /> إلغاء
          </button>
        )}
      </div>

      {showReturn && returning && (
        <div className="space-y-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-2.5">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات الحالة (اختياري)"
            className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2.5 text-[12px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={damaged}
                onChange={(e) => setDamaged(e.target.checked)}
                className="accent-[var(--danger)]"
              />
              وصلت بها أضرار
            </label>
            <div className="flex gap-1.5">
              <button
                className={btn}
                onClick={() => setReturning(false)}
                disabled={pending}
              >
                إلغاء
              </button>
              <button
                className={primaryBtn}
                disabled={pending}
                onClick={() =>
                  run(() =>
                    returnReservation(r.id, r.equipmentId, notes.trim() || null, damaged),
                  )
                }
              >
                <RotateCcw size={12} /> تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="inline-flex items-center gap-1 text-[11px] text-[var(--danger)]">
          <AlertTriangle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

export function ReservationsManager({ rows }: { rows: ReservationRow[] }) {
  const statuses = Array.from(new Set(rows.map((r) => r.status))).filter(Boolean);
  const windows = Array.from(new Set(rows.map((r) => r.window)));

  const allFilters: FilterDef<ReservationRow>[] = [
    {
      key: 'status',
      label: 'الحالة',
      options: statuses.map((s) => ({ value: s, label: STATUS_LABEL_AR[s] ?? s })),
      predicate: (row, value) => row.status === value,
    },
    {
      key: 'window',
      label: 'التوقيت',
      options: (['active', 'upcoming', 'past'] as const)
        .filter((w) => windows.includes(w))
        .map((w) => ({ value: w, label: WINDOW_LABEL_AR[w] ?? w })),
      predicate: (row, value) => row.window === value,
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const targetCell = (r: ReservationRow) =>
    r.equipmentId ? (
      <Link href={`/equipment/${r.equipmentId}`} className="group block">
        {r.eqCode && (
          <span className="font-mono text-[10px] text-[var(--text-dim)]">{r.eqCode} </span>
        )}
        <span className="text-[13px] text-[var(--text)] group-hover:text-[var(--accent)]">
          {targetLabel(r)}
        </span>
      </Link>
    ) : (
      <span className="text-[12px] italic text-[var(--text-muted)]">{targetLabel(r)}</span>
    );

  const projectCell = (r: ReservationRow) =>
    r.projectId ? (
      <Link
        href={`/projects/${r.projectId}`}
        className="text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        {r.projectCode && (
          <span className="font-mono text-[10px] text-[var(--text-dim)]">{r.projectCode} </span>
        )}
        {r.projectTitleAr ?? r.projectTitle ?? '—'}
      </Link>
    ) : (
      <span className="text-[12px] text-[var(--text-dim)]">—</span>
    );

  const columns: ColumnDef<ReservationRow>[] = [
    {
      key: 'window',
      header: 'التوقيت',
      sortable: true,
      sortValue: (r) => new Date(r.startsAt).getTime(),
      cell: (r) => (
        <div>
          <p className="font-mono text-[11px] text-[var(--text-dim)]">{fmtDate(r.startsAt)}</p>
          <p className="font-mono text-[10px] text-[var(--text-muted)]">
            {fmtTime(r.startsAt)} → {fmtDate(r.endsAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'المعدّة',
      sortable: true,
      sortValue: (r) => targetLabel(r),
      cell: targetCell,
    },
    {
      key: 'project',
      header: 'المشروع',
      sortable: true,
      sortValue: (r) => r.projectTitleAr ?? r.projectTitle ?? '',
      cell: projectCell,
    },
    {
      key: 'reservedBy',
      header: 'بإذن',
      sortable: true,
      sortValue: (r) => r.reservedByName ?? '',
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">{r.reservedByName ?? '—'}</span>
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
    {
      key: 'actions',
      header: '',
      cell: (r) => <RowActions r={r} />,
    },
  ];

  const renderCard = (r: ReservationRow) => (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">{targetCell(r)}</div>
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
      </div>
      <div className="mt-2 space-y-1">
        <p className="text-[11px] text-[var(--text-muted)]">{projectCell(r)}</p>
        <p className="font-mono text-[10px] text-[var(--text-dim)]">
          {fmtDate(r.startsAt)} {fmtTime(r.startsAt)} → {fmtDate(r.endsAt)}
        </p>
        {r.reservedByName && (
          <p className="text-[11px] text-[var(--text-muted)]">
            بإذن <span className="text-[var(--text)]">{r.reservedByName}</span>
          </p>
        )}
        {r.notes && <p className="text-[11px] text-[var(--text-dim)]">{r.notes}</p>}
      </div>
      <div className="mt-3 border-t border-[var(--line)] pt-3">
        <RowActions r={r} />
      </div>
    </div>
  );

  const renderCompact = (r: ReservationRow) => (
    <div className="flex items-center gap-3 text-[12px]">
      <span className="w-24 shrink-0 font-mono text-[10px] text-[var(--text-dim)]">
        {fmtDate(r.startsAt)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">{targetLabel(r)}</span>
      <span className="hidden w-32 shrink-0 truncate text-[var(--text-muted)] sm:inline">
        {r.projectTitleAr ?? r.projectTitle ?? '—'}
      </span>
      <span className="shrink-0">
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
      </span>
    </div>
  );

  return (
    <ListWorkspace<ReservationRow>
      rows={rows}
      storageKey="equipment-reservations"
      getId={(r) => r.id}
      searchText={(r) =>
        [
          r.eqCode,
          r.eqModel,
          r.eqManufacturer,
          r.groupNameAr,
          r.projectCode,
          r.projectTitle,
          r.projectTitleAr,
          r.reservedByName,
          r.notes,
        ]
          .filter(Boolean)
          .join(' ')
      }
      filters={filters}
      columns={columns}
      renderCard={renderCard}
      renderCompact={renderCompact}
      defaultView="table"
      emptyState={
        <EmptyState
          icon={<Camera size={18} />}
          title="لا نتائج"
          description="جرّب تعديل البحث أو الفلاتر."
        />
      }
    />
  );
}
