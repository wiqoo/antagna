'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';
import {
  Mail,
  Sparkles,
  ShieldAlert,
  Archive,
  CheckCheck,
  RotateCcw,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import {
  classifyInboxAction,
  markThreadsSpam,
  archiveThreads,
  markThreadsRead,
  reopenThreads,
} from './actions';

export interface InboxThreadRow {
  id: string;
  subject: string | null;
  status: string;
  category: string | null;
  importance: string | null;
  messageCount: number | null;
  lastMessageAt: string | null;
  aiSummary: string | null;
  nextAction: string | null;
  clientNameAr: string | null;
  primaryContactName: string | null;
  fromName: string | null;
  fromEmail: string | null;
  assignedName: string | null;
  projectCode: string | null;
  projectId: string | null;
}

const THREAD_STATUS_TONE: Record<
  string,
  'info' | 'warning' | 'danger' | 'success' | 'neutral'
> = {
  open: 'info',
  in_progress: 'warning',
  waiting_client: 'warning',
  closed: 'success',
  spam: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'مفتوح',
  in_progress: 'قيد العمل',
  waiting_client: 'بانتظار العميل',
  closed: 'مؤرشف',
  spam: 'مخفي',
};

const CATEGORY_LABEL: Record<string, string> = {
  actionable: 'يحتاج إجراء',
  marketing: 'تسويق',
  newsletter: 'نشرة',
  notification: 'إشعار',
  spam: 'سبام',
};

const CATEGORY_TONE: Record<string, 'info' | 'warning' | 'danger' | 'success' | 'neutral'> = {
  actionable: 'info',
  marketing: 'neutral',
  newsletter: 'neutral',
  notification: 'neutral',
  spam: 'danger',
};

const IMPORTANCE_LABEL: Record<string, string> = {
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
};
const IMPORTANCE_TONE: Record<string, 'danger' | 'warning' | 'neutral'> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};
const IMPORTANCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

const NOISE = new Set(['marketing', 'newsletter', 'spam']);

function fmtAge(ts: string | null): string {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 0) return 'الآن';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} س`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ي`;
  return `${Math.floor(days / 30)} ش`;
}

/** A thread is hidden by default when AI-classified as noise OR status spam. */
function isNoise(r: InboxThreadRow): boolean {
  return r.status === 'spam' || (r.category != null && NOISE.has(r.category));
}

function senderLabel(r: InboxThreadRow): string {
  return r.fromName || r.fromEmail || r.primaryContactName || '—';
}

export function InboxThreads({ rows }: { rows: InboxThreadRow[] }) {
  const [showNoise, setShowNoise] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  // Default view excludes noise; a toggle brings it back.
  const baseRows = useMemo(
    () => (showNoise ? rows : rows.filter((r) => !isNoise(r))),
    [rows, showNoise],
  );

  const noiseCount = useMemo(() => rows.filter(isNoise).length, [rows]);

  const selectedVisible = useMemo(
    () => baseRows.filter((r) => selected.has(r.id)),
    [baseRows, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === baseRows.length && baseRows.length > 0
        ? new Set()
        : new Set(baseRows.map((r) => r.id)),
    );
  }

  function runBulk(
    fn: (ids: string[]) => Promise<{ updated: number }>,
    verb: string,
  ) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      try {
        const res = await fn(ids);
        setToast(`${verb} ${res.updated} محادثة`);
        setSelected(new Set());
      } catch {
        setToast('تعذّر تنفيذ العملية — تحقّق من الصلاحية.');
      }
      setTimeout(() => setToast(null), 3000);
    });
  }

  function runClassify() {
    startTransition(async () => {
      try {
        const res = await classifyInboxAction(25);
        setToast(
          res.classified === 0
            ? 'لا جديد للتصنيف — كل المحادثات مُصنَّفة.'
            : `صنَّف ${res.classified} محادثة · أخفى ${res.hidden} ضوضاء`,
        );
      } catch {
        setToast('تعذّر التصنيف — تحقّق من الصلاحية.');
      }
      setTimeout(() => setToast(null), 3500);
    });
  }

  const filters: FilterDef<InboxThreadRow>[] = [
    {
      key: 'status',
      label: 'الحالة',
      options: [
        { value: 'open', label: 'مفتوح' },
        { value: 'in_progress', label: 'قيد العمل' },
        { value: 'waiting_client', label: 'بانتظار العميل' },
        { value: 'closed', label: 'مؤرشف' },
        { value: 'spam', label: 'مخفي' },
      ],
      predicate: (row, value) => row.status === value,
    },
    {
      key: 'importance',
      label: 'الأهمية',
      options: [
        { value: 'high', label: 'عالية' },
        { value: 'medium', label: 'متوسطة' },
        { value: 'low', label: 'منخفضة' },
      ],
      predicate: (row, value) => (row.importance ?? '') === value,
    },
    {
      key: 'category',
      label: 'التصنيف',
      options: [
        { value: 'actionable', label: 'يحتاج إجراء' },
        { value: 'notification', label: 'إشعار' },
        { value: 'marketing', label: 'تسويق' },
        { value: 'newsletter', label: 'نشرة' },
        { value: 'spam', label: 'سبام' },
      ],
      predicate: (row, value) => (row.category ?? '') === value,
    },
  ];

  const checkboxCol: ColumnDef<InboxThreadRow> = {
    key: 'select',
    header: '',
    cell: (r) => (
      <input
        type="checkbox"
        aria-label="تحديد"
        checked={selected.has(r.id)}
        onChange={() => toggle(r.id)}
        className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
      />
    ),
  };

  const columns: ColumnDef<InboxThreadRow>[] = [
    checkboxCol,
    {
      key: 'sender',
      header: 'المُرسِل',
      sortable: true,
      sortValue: (r) => senderLabel(r),
      cell: (r) => (
        <Link href={`/inbox/${r.id}`} className="group block min-w-0">
          <span className="block truncate text-[13px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
            {senderLabel(r)}
          </span>
          {r.fromEmail && (
            <span className="block truncate font-mono text-[10px] text-[var(--text-dim)]" dir="ltr">
              {r.fromEmail}
            </span>
          )}
        </Link>
      ),
    },
    {
      key: 'subject',
      header: 'الموضوع',
      sortable: true,
      sortValue: (r) => r.subject ?? '',
      cell: (r) => (
        <Link href={`/inbox/${r.id}`} className="group block min-w-0 max-w-[22rem]">
          <span className="block truncate text-[13px] text-[var(--text)] group-hover:text-[var(--accent)]">
            {r.subject ?? '(بدون عنوان)'}
          </span>
          {r.aiSummary && (
            <span className="mt-0.5 block truncate text-[11px] text-[var(--text-dim)]">
              {r.aiSummary}
            </span>
          )}
        </Link>
      ),
    },
    {
      key: 'client',
      header: 'العميل · المشروع',
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">
          {r.clientNameAr ?? '—'}
          {r.projectCode && r.projectId ? (
            <Link
              href={`/projects/${r.projectId}`}
              className="ms-1 font-mono text-[var(--accent)] hover:underline"
            >
              {r.projectCode}
            </Link>
          ) : null}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'التصنيف',
      sortable: true,
      sortValue: (r) => r.category ?? '',
      cell: (r) =>
        r.category ? (
          <StatusPill tone={CATEGORY_TONE[r.category] ?? 'neutral'}>
            {CATEGORY_LABEL[r.category] ?? r.category}
          </StatusPill>
        ) : (
          <span className="text-[11px] text-[var(--text-dim)]">غير مُصنَّف</span>
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
      sortable: true,
      sortValue: (r) => r.status,
      cell: (r) => (
        <StatusPill tone={THREAD_STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL[r.status] ?? r.status}
        </StatusPill>
      ),
    },
    {
      key: 'importance',
      header: 'الأهمية',
      sortable: true,
      sortValue: (r) => IMPORTANCE_RANK[r.importance ?? ''] ?? 0,
      cell: (r) =>
        r.importance ? (
          <StatusPill tone={IMPORTANCE_TONE[r.importance] ?? 'neutral'}>
            {IMPORTANCE_LABEL[r.importance] ?? r.importance}
          </StatusPill>
        ) : (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ),
    },
    {
      key: 'age',
      header: 'العمر',
      sortable: true,
      sortValue: (r) => (r.lastMessageAt ? new Date(r.lastMessageAt).getTime() : 0),
      cell: (r) => (
        <span className="font-mono text-[11px] text-[var(--text-dim)]">
          {fmtAge(r.lastMessageAt)}
        </span>
      ),
    },
    {
      key: 'nextAction',
      header: 'الخطوة التالية',
      cell: (r) =>
        r.nextAction ? (
          <span className="block max-w-[16rem] truncate text-[12px] text-[var(--text-muted)]">
            <Sparkles size={10} className="me-1 inline text-[var(--accent)]" />
            {r.nextAction}
          </span>
        ) : (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ),
    },
  ];

  const renderCard = (r: InboxThreadRow) => (
    <div className="relative h-full">
      <input
        type="checkbox"
        aria-label="تحديد"
        checked={selected.has(r.id)}
        onChange={() => toggle(r.id)}
        className="absolute end-3 top-3 z-10 h-4 w-4 cursor-pointer accent-[var(--accent)]"
      />
      <Link
        href={`/inbox/${r.id}`}
        className="block h-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)]"
      >
        <div className="flex items-start justify-between gap-2 pe-6">
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text)]">
            {senderLabel(r)}
          </p>
          {r.importance && (
            <StatusPill tone={IMPORTANCE_TONE[r.importance] ?? 'neutral'}>
              {IMPORTANCE_LABEL[r.importance] ?? r.importance}
            </StatusPill>
          )}
        </div>
        <p className="mt-1 truncate text-[13px] text-[var(--text-muted)]">
          {r.subject ?? '(بدون عنوان)'}
        </p>
        {r.aiSummary && (
          <p className="mt-1.5 line-clamp-2 text-[11px] text-[var(--text-dim)]">{r.aiSummary}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {r.category && (
            <StatusPill tone={CATEGORY_TONE[r.category] ?? 'neutral'}>
              {CATEGORY_LABEL[r.category] ?? r.category}
            </StatusPill>
          )}
          <StatusPill tone={THREAD_STATUS_TONE[r.status] ?? 'neutral'}>
            {STATUS_LABEL[r.status] ?? r.status}
          </StatusPill>
          {r.projectCode && (
            <span className="font-mono text-[10px] text-[var(--accent)]">{r.projectCode}</span>
          )}
        </div>
        {r.nextAction && (
          <p className="mt-2 line-clamp-1 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--text-muted)]">
            <Sparkles size={10} className="me-1 inline text-[var(--accent)]" />
            {r.nextAction}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-dim)]">
          <span>{r.clientNameAr ?? r.assignedName ?? 'غير مُسند'}</span>
          <span className="font-mono">{fmtAge(r.lastMessageAt)} · {r.messageCount ?? 0} msg</span>
        </div>
      </Link>
    </div>
  );

  const allSelected = selected.size > 0 && selected.size === baseRows.length;
  const anySelected = selected.size > 0;
  const noiseSelected = selectedVisible.some(isNoise);

  const btn =
    'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[11px] font-medium transition-colors disabled:opacity-50';

  const toolbarExtra = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={runClassify}
        disabled={pending}
        className={`${btn} border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20`}
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        صنِّف بالـ AI
      </button>
      <button
        type="button"
        onClick={() => setShowNoise((s) => !s)}
        className={`${btn} border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)]`}
      >
        {showNoise ? <EyeOff size={12} /> : <Eye size={12} />}
        {showNoise ? 'إخفاء الضوضاء' : `إظهار الضوضاء (${noiseCount})`}
      </button>
    </div>
  );

  return (
    <div>
      {toast && (
        <div className="mb-3 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-[12px] text-[var(--accent)]">
          {toast}
        </div>
      )}

      {/* Bulk-action bar — appears when rows are selected. */}
      {anySelected && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2">
          <span className="text-[12px] font-medium text-[var(--text)]">
            {selected.size} محدَّدة
          </span>
          <button
            type="button"
            onClick={toggleAll}
            className="text-[11px] text-[var(--text-dim)] underline hover:text-[var(--text)]"
          >
            {allSelected ? 'إلغاء التحديد' : 'تحديد الكل'}
          </button>
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => runBulk(markThreadsRead, 'تمّ تعليم')}
              className={`${btn} border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]`}
            >
              <CheckCheck size={12} /> تعليم كمقروء
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => runBulk(archiveThreads, 'تمّ أرشفة')}
              className={`${btn} border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]`}
            >
              <Archive size={12} /> أرشفة
            </button>
            {noiseSelected ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => runBulk(reopenThreads, 'تمّ إرجاع')}
                className={`${btn} border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]`}
              >
                <RotateCcw size={12} /> إرجاع للوارد
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => runBulk(markThreadsSpam, 'تمّ إخفاء')}
                className={`${btn} border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger)]/10`}
              >
                <ShieldAlert size={12} /> تعليم كسبام
              </button>
            )}
          </div>
        </div>
      )}

      <ListWorkspace<InboxThreadRow>
        rows={baseRows}
        storageKey="inbox-threads"
        getId={(r) => r.id}
        searchText={(r) =>
          `${r.subject ?? ''} ${senderLabel(r)} ${r.fromEmail ?? ''} ${r.clientNameAr ?? ''} ${r.primaryContactName ?? ''} ${r.projectCode ?? ''} ${r.aiSummary ?? ''}`
        }
        filters={filters}
        columns={columns}
        renderCard={renderCard}
        defaultView="table"
        toolbarExtra={toolbarExtra}
        emptyState={
          <EmptyState
            icon={<Mail size={20} />}
            title={showNoise ? 'لا threads بعد' : 'صندوق وارد نظيف'}
            description={
              showNoise
                ? 'عند ربط Gmail ستظهر محادثات البريد هنا تلقائيًا.'
                : noiseCount > 0
                  ? `كل ما يحتاج انتباهك تمّت معالجته. ${noiseCount} رسالة ضوضاء مخفية — اضغط "إظهار الضوضاء" لعرضها.`
                  : 'عند ربط Gmail ستظهر محادثات البريد المهمة هنا، مُصنَّفة بالـ AI وخالية من الضجيج.'
            }
          />
        }
      />
    </div>
  );
}
