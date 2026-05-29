'use client';

import Link from 'next/link';
import {
  ListWorkspace,
  StatusPill,
  Avatar,
  EmptyState,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';
import { Mail } from 'lucide-react';

export interface InboxThreadRow {
  id: string;
  subject: string | null;
  status: string;
  messageCount: number | null;
  lastMessageAt: string | null;
  aiSummary: string | null;
  clientNameAr: string | null;
  primaryContactName: string | null;
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
  closed: 'مغلق',
  spam: 'سبام',
};

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().slice(0, 16).replace('T', ' ');
}

export function InboxThreads({ rows }: { rows: InboxThreadRow[] }) {
  const filters: FilterDef<InboxThreadRow>[] = [
    {
      key: 'status',
      label: 'الحالة',
      options: [
        { value: 'open', label: 'مفتوح' },
        { value: 'in_progress', label: 'قيد العمل' },
        { value: 'waiting_client', label: 'بانتظار العميل' },
        { value: 'closed', label: 'مغلق' },
        { value: 'spam', label: 'سبام' },
      ],
      predicate: (row, value) => row.status === value,
    },
  ];

  const columns: ColumnDef<InboxThreadRow>[] = [
    {
      key: 'subject',
      header: 'الموضوع',
      cell: (r) => (
        <Link
          href={`/inbox/${r.id}`}
          className="font-medium text-[var(--text)] hover:text-[var(--accent)]"
        >
          {r.subject ?? '(بدون عنوان)'}
        </Link>
      ),
    },
    {
      key: 'client',
      header: 'العميل',
      cell: (r) => (
        <span className="text-[var(--text-muted)]">
          {r.clientNameAr ?? '—'}
          {r.primaryContactName && (
            <span className="text-[var(--text-dim)]"> · {r.primaryContactName}</span>
          )}
        </span>
      ),
    },
    {
      key: 'assignee',
      header: 'المسؤول',
      cell: (r) => (
        <span className="text-[var(--text-muted)]">{r.assignedName ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (r) => (
        <StatusPill tone={THREAD_STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL[r.status] ?? r.status}
        </StatusPill>
      ),
    },
    {
      key: 'lastMessageAt',
      header: 'آخر رسالة',
      sortable: true,
      sortValue: (r) => (r.lastMessageAt ? new Date(r.lastMessageAt).getTime() : 0),
      cell: (r) => (
        <span className="font-mono text-[11px] text-[var(--text-dim)]">
          {fmt(r.lastMessageAt)}
        </span>
      ),
    },
  ];

  const renderCard = (r: InboxThreadRow) => (
    <Link
      href={`/inbox/${r.id}`}
      className="block h-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)]"
    >
      <div className="flex items-start gap-3">
        <Avatar name={r.clientNameAr ?? r.primaryContactName ?? '?'} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium leading-snug text-[var(--text)]">
              {r.subject ?? '(بدون عنوان)'}
            </p>
            <StatusPill tone={THREAD_STATUS_TONE[r.status] ?? 'neutral'}>
              {STATUS_LABEL[r.status] ?? r.status}
            </StatusPill>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {r.clientNameAr ?? '—'}
            {r.primaryContactName && <> · {r.primaryContactName}</>}
            {r.projectCode && (
              <span className="ms-1 font-mono text-[var(--accent)]">{r.projectCode}</span>
            )}
          </p>
        </div>
      </div>
      {r.aiSummary && (
        <p className="mt-2 line-clamp-2 text-xs text-[var(--text)]">{r.aiSummary}</p>
      )}
      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-dim)]">
        <span>{r.assignedName ?? 'غير مُسند'}</span>
        <span className="font-mono">{fmt(r.lastMessageAt)} · {r.messageCount ?? 0} msg</span>
      </div>
    </Link>
  );

  return (
    <ListWorkspace<InboxThreadRow>
      rows={rows}
      storageKey="inbox-threads"
      getId={(r) => r.id}
      searchText={(r) =>
        `${r.subject ?? ''} ${r.clientNameAr ?? ''} ${r.primaryContactName ?? ''}`
      }
      filters={filters}
      columns={columns}
      renderCard={renderCard}
      defaultView="table"
      emptyState={
        <EmptyState
          icon={<Mail size={20} />}
          title="لا threads بعد"
          description="عند ربط Gmail ستظهر محادثات البريد هنا تلقائيًا — مفلترة حسب الحالة وقابلة للبحث."
        />
      }
    />
  );
}
