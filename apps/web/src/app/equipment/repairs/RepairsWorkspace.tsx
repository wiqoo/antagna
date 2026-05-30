'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  Plus,
  AlertTriangle,
  Check,
  Send,
  Clock,
  X,
} from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';
import { createRepair, setRepairStatus, updateRepairEta } from './actions';

export interface RepairRow {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentModel: string;
  equipmentManufacturer: string | null;
  issueDescription: string;
  severity: string;
  status: string;
  vendor: string | null;
  costSar: string | number | null;
  eta: string | null; // returned_at — planned (open) or actual (fixed)
  reportedAt: string;
  reporterName: string | null;
}

export interface EquipOption {
  id: string;
  code: string;
  model: string;
  manufacturer: string | null;
  status: string;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  reported: 'danger',
  in_progress: 'warning',
  fixed: 'success',
};
const STATUS_AR: Record<string, string> = {
  reported: 'مُبلَّغ',
  in_progress: 'قيد الإصلاح',
  fixed: 'تم الإصلاح',
};
const SEVERITY_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  minor: 'neutral',
  major: 'warning',
  unusable: 'danger',
};
const SEVERITY_AR: Record<string, string> = {
  minor: 'بسيط',
  major: 'كبير',
  unusable: 'معطّل تماماً',
};

function fmtDate(v: string | null): string {
  if (!v) return '—';
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return '—';
  }
}
function fmtSar(v: string | number | null): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}
function model(r: RepairRow): string {
  return [r.equipmentManufacturer, r.equipmentModel].filter(Boolean).join(' ');
}

const inputCls =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[12px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none';
const btn =
  'inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-50';
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50';

export function RepairsWorkspace({
  rows,
  equipmentOptions,
  initialFilters,
  presetEquipmentId,
  canEdit,
}: {
  rows: RepairRow[];
  equipmentOptions: EquipOption[];
  initialFilters?: Record<string, string>;
  presetEquipmentId?: string | null;
  canEdit: boolean;
}) {
  // Deep-linked from an equipment detail page → open the form pre-selected.
  // Viewers without equipment.update never get the form open by default.
  const [showForm, setShowForm] = useState(canEdit && !!presetEquipmentId);

  const filters: FilterDef<RepairRow>[] = [
    {
      key: 'status',
      label: 'الحالة',
      options: (['reported', 'in_progress', 'fixed'] as const).map((s) => ({
        value: s,
        label: STATUS_AR[s] ?? s,
      })),
      predicate: (row, value) => row.status === value,
    },
    {
      key: 'severity',
      label: 'الخطورة',
      options: (['minor', 'major', 'unusable'] as const).map((s) => ({
        value: s,
        label: SEVERITY_AR[s] ?? s,
      })),
      predicate: (row, value) => row.severity === value,
    },
  ];

  const columns: ColumnDef<RepairRow>[] = [
    {
      key: 'equipment',
      header: 'المعدة',
      sortable: true,
      sortValue: (r) => model(r),
      cell: (r) => (
        <Link href={`/equipment/${r.equipmentId}`} className="group block">
          <span className="font-mono text-[10px] text-[var(--text-dim)]">
            {r.equipmentCode}
          </span>
          <span className="block truncate text-[13px] text-[var(--text)] group-hover:text-[var(--accent)]">
            {r.equipmentManufacturer && (
              <span className="text-[var(--text-dim)]">{r.equipmentManufacturer} </span>
            )}
            {r.equipmentModel}
          </span>
        </Link>
      ),
    },
    {
      key: 'issue',
      header: 'العطل',
      cell: (r) => (
        <span className="block max-w-[260px] truncate text-[12px] text-[var(--text-muted)]">
          {r.issueDescription}
        </span>
      ),
    },
    {
      key: 'severity',
      header: 'الخطورة',
      sortable: true,
      sortValue: (r) => r.severity,
      cell: (r) => (
        <StatusPill tone={SEVERITY_TONE[r.severity] ?? 'neutral'}>
          {SEVERITY_AR[r.severity] ?? r.severity}
        </StatusPill>
      ),
    },
    {
      key: 'vendor',
      header: 'جهة الإصلاح',
      sortable: true,
      sortValue: (r) => r.vendor ?? '',
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">{r.vendor ?? '—'}</span>
      ),
    },
    {
      key: 'eta',
      header: 'ETA / الإرجاع',
      sortable: true,
      sortValue: (r) => r.eta ?? '',
      cell: (r) => (
        <span className="font-mono text-[11px] text-[var(--text-muted)]">{fmtDate(r.eta)}</span>
      ),
    },
    {
      key: 'cost',
      header: 'التكلفة',
      sortable: true,
      sortValue: (r) => Number(r.costSar ?? 0),
      cell: (r) => {
        const s = fmtSar(r.costSar);
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
      header: 'الحالة',
      sortable: true,
      sortValue: (r) => r.status,
      cell: (r) => (
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_AR[r.status] ?? r.status}
        </StatusPill>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => <RepairActions row={r} canEdit={canEdit} />,
    },
  ];

  const renderCard = (r: RepairRow) => (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/equipment/${r.equipmentId}`} className="group min-w-0">
          <span className="font-mono text-[10px] text-[var(--text-dim)]">
            {r.equipmentCode}
          </span>
          <p className="truncate text-[13px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
            {model(r)}
          </p>
        </Link>
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_AR[r.status] ?? r.status}
        </StatusPill>
      </div>
      <p className="mt-2 line-clamp-2 text-[12px] text-[var(--text-muted)]">
        {r.issueDescription}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-dim)]">
        <StatusPill tone={SEVERITY_TONE[r.severity] ?? 'neutral'}>
          {SEVERITY_AR[r.severity] ?? r.severity}
        </StatusPill>
        {r.vendor && <span>{r.vendor}</span>}
        <span className="font-mono">ETA {fmtDate(r.eta)}</span>
      </div>
      {canEdit && (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <RepairActions row={r} canEdit={canEdit} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--text-muted)]">
          {rows.filter((r) => r.status !== 'fixed').length} بلاغ مفتوح ·{' '}
          {rows.length} إجمالاً
        </p>
        {canEdit && (
          <button
            className={primaryBtn}
            onClick={() => setShowForm((v) => !v)}
            disabled={equipmentOptions.length === 0}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'إغلاق' : 'بلاغ عطل جديد'}
          </button>
        )}
      </div>

      {canEdit && showForm && (
        <CreateRepairForm
          equipmentOptions={equipmentOptions}
          presetEquipmentId={presetEquipmentId ?? null}
          onDone={() => setShowForm(false)}
        />
      )}

      <ListWorkspace<RepairRow>
        rows={rows}
        storageKey="equipment-repairs"
        getId={(r) => r.id}
        searchText={(r) =>
          [r.equipmentCode, model(r), r.issueDescription, r.vendor, r.reporterName]
            .filter(Boolean)
            .join(' ')
        }
        filters={filters}
        columns={columns}
        renderCard={renderCard}
        defaultView="table"
        initialFilters={initialFilters}
        emptyState={
          <EmptyState
            icon={<Wrench size={18} />}
            title="لا بلاغات صيانة"
            description="كل المعدات سليمة. سجّل عطلاً عند ظهوره ليُتابَع حتى الإصلاح."
            action={
              canEdit && equipmentOptions.length > 0 ? (
                <button className={primaryBtn} onClick={() => setShowForm(true)}>
                  <Plus size={14} /> بلاغ عطل جديد
                </button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}

function CreateRepairForm({
  equipmentOptions,
  presetEquipmentId,
  onDone,
}: {
  equipmentOptions: EquipOption[];
  presetEquipmentId: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4 space-y-3"
      action={(fd) =>
        start(async () => {
          setError(null);
          const r = await createRepair(fd);
          if (!r.ok) setError(r.error ?? 'تعذّر فتح البلاغ');
          else {
            onDone();
            router.refresh();
          }
        })
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--text-dim)]">المعدة *</span>
          <select
            name="equipmentId"
            required
            defaultValue={
              presetEquipmentId && equipmentOptions.some((o) => o.id === presetEquipmentId)
                ? presetEquipmentId
                : ''
            }
            className={inputCls}
          >
            <option value="" disabled>
              اختر المعدة…
            </option>
            {equipmentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} · {[o.manufacturer, o.model].filter(Boolean).join(' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--text-dim)]">الخطورة</span>
          <select name="severity" defaultValue="minor" className={inputCls}>
            <option value="minor">بسيط</option>
            <option value="major">كبير</option>
            <option value="unusable">معطّل تماماً</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] text-[var(--text-dim)]">وصف العطل *</span>
        <textarea
          name="issueDescription"
          required
          rows={2}
          placeholder="مثال: لا تشحن، خدش بالعدسة، صوت غير طبيعي…"
          className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--text-dim)]">
            جهة الإصلاح (الفنّي/الورشة)
          </span>
          <input type="text" name="vendor" placeholder="اسم الفنّي أو الورشة" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--text-dim)]">
            ETA (موعد الإرجاع المتوقّع)
          </span>
          <input type="date" name="eta" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--text-dim)]">ملاحظات</span>
          <input type="text" name="notes" placeholder="اختياري" className={inputCls} />
        </label>
      </div>

      {error && (
        <p className="inline-flex items-center gap-1.5 text-[12px] text-[var(--danger)]">
          <AlertTriangle size={13} /> {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button type="button" className={btn} onClick={onDone} disabled={pending}>
          إلغاء
        </button>
        <button type="submit" className={primaryBtn} disabled={pending}>
          <Wrench size={14} /> فتح البلاغ
        </button>
      </div>
    </form>
  );
}

function RepairActions({ row, canEdit }: { row: RepairRow; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editEta, setEditEta] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'تعذّر تنفيذ الإجراء');
      else {
        setEditEta(false);
        router.refresh();
      }
    });

  // Read-only viewers see status pills in their columns; no mutate controls.
  if (!canEdit) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {row.status === 'reported' && (
          <button
            className={btn}
            disabled={pending}
            onClick={() => run(() => setRepairStatus(row.id, row.equipmentId, 'in_progress'))}
          >
            <Send size={12} /> بدء الإصلاح
          </button>
        )}
        {row.status !== 'fixed' && (
          <>
            <button
              className={btn}
              disabled={pending}
              onClick={() => setEditEta((v) => !v)}
            >
              <Clock size={12} /> ETA / التكلفة
            </button>
            <button
              className={primaryBtn}
              disabled={pending}
              onClick={() => run(() => setRepairStatus(row.id, row.equipmentId, 'fixed'))}
            >
              <Check size={12} /> تم الإصلاح
            </button>
          </>
        )}
      </div>

      {editEta && row.status !== 'fixed' && (
        <form
          className="flex flex-wrap items-end justify-end gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-2"
          action={(fd) => run(() => updateRepairEta(row.id, row.equipmentId, fd))}
        >
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-[var(--text-dim)]">ETA</span>
            <input
              type="date"
              name="eta"
              defaultValue={row.eta ? row.eta.slice(0, 10) : ''}
              className="h-8 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-[var(--text-dim)]">الجهة</span>
            <input
              type="text"
              name="vendor"
              defaultValue={row.vendor ?? ''}
              placeholder="الفنّي/الورشة"
              className="h-8 w-32 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-[var(--text-dim)]">التكلفة (SAR)</span>
            <input
              type="text"
              name="costSar"
              defaultValue={row.costSar != null ? String(row.costSar) : ''}
              inputMode="decimal"
              className="h-8 w-24 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>
          <button type="submit" className={primaryBtn} disabled={pending}>
            حفظ
          </button>
        </form>
      )}

      {error && (
        <p className="inline-flex items-center justify-end gap-1.5 text-[11px] text-[var(--danger)]">
          <AlertTriangle size={12} /> {error}
        </p>
      )}
    </div>
  );
}
