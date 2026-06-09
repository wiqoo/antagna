'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCheck,
  RotateCcw,
  ExternalLink,
  Inbox,
} from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';
import { markRead, markUnread, markAllRead } from './actions';
import { useFormat } from '@/lib/format';

export interface NotifRow {
  id: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  entityType: string | null;
  eventTypeKey: string | null;
  category: string | null;
  categoryLabel: string | null;
  read: boolean;
  createdAt: string; // ISO
}

const CATEGORY_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  project: 'info',
  task: 'info',
  equipment: 'warning',
  approval: 'success',
  revision: 'warning',
  deadline: 'danger',
  mention: 'info',
  system: 'neutral',
};

function RowActions({ n }: { n: NotifRow }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {n.linkUrl && (
        <Link
          href={n.linkUrl}
          onClick={() => {
            if (!n.read) start(() => markRead(n.id));
          }}
          title="افتح"
          className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <ExternalLink size={14} />
        </Link>
      )}
      {n.read ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => markUnread(n.id))}
          title="علّم كغير مقروء"
          className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--line-strong)] hover:text-[var(--text)] disabled:opacity-50"
        >
          <RotateCcw size={14} />
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => markRead(n.id))}
          title="علّم مقروء"
          className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          <Check size={14} />
        </button>
      )}
    </div>
  );
}

function NotifCard({ n }: { n: NotifRow }) {
  const f = useFormat();
  const tone = (n.category && CATEGORY_TONE[n.category]) || 'neutral';
  return (
    <div
      className={
        'group relative flex items-start gap-3 rounded-lg border px-4 py-3.5 transition-colors ' +
        (n.read
          ? 'border-[var(--line)] bg-[var(--bg-elevated)]/30 opacity-80'
          : 'border-[var(--line-strong)] bg-[var(--surface)]/50')
      }
    >
      <span
        className={
          'mt-1.5 h-2 w-2 shrink-0 rounded-full ' +
          (n.read ? 'bg-transparent ring-1 ring-[var(--line-strong)]' : 'bg-[var(--accent)]')
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className={
                'text-[14px] ' +
                (n.read ? 'font-medium text-[var(--text-muted)]' : 'font-semibold text-[var(--text)]')
              }
            >
              {n.title}
            </p>
            {n.body && (
              <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                {n.body}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {n.categoryLabel && (
                <StatusPill tone={tone}>{n.categoryLabel}</StatusPill>
              )}
              <span className="text-[11px] text-[var(--text-dim)]">
                {f.relative(n.createdAt)}
              </span>
            </div>
          </div>
          <RowActions n={n} />
        </div>
      </div>
    </div>
  );
}

export function NotificationsList({ rows }: { rows: NotifRow[] }) {
  const f = useFormat();
  const [tab, setTab] = useState<'unread' | 'all'>(
    rows.some((r) => !r.read) ? 'unread' : 'all',
  );
  const [allPending, startAll] = useTransition();

  const unreadCount = rows.filter((r) => !r.read).length;
  const visible = tab === 'unread' ? rows.filter((r) => !r.read) : rows;

  const filters: FilterDef<NotifRow>[] = [];
  const categories = Array.from(
    new Map(
      rows
        .filter((r) => r.category && r.categoryLabel)
        .map((r) => [r.category as string, r.categoryLabel as string]),
    ).entries(),
  );
  if (categories.length > 1) {
    filters.push({
      key: 'category',
      label: 'التصنيف',
      options: categories.map(([value, label]) => ({ value, label })),
      predicate: (row, value) => row.category === value,
    });
  }

  const columns: ColumnDef<NotifRow>[] = [
    {
      key: 'title',
      header: 'الإشعار',
      cell: (r) => (
        <div className="flex items-center gap-2">
          {!r.read && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
          <span className={r.read ? 'text-[var(--text-muted)]' : 'font-semibold text-[var(--text)]'}>
            {r.title}
          </span>
        </div>
      ),
      sortable: true,
      sortValue: (r) => r.title,
    },
    {
      key: 'category',
      header: 'التصنيف',
      cell: (r) =>
        r.categoryLabel ? (
          <StatusPill tone={(r.category && CATEGORY_TONE[r.category]) || 'neutral'}>
            {r.categoryLabel}
          </StatusPill>
        ) : (
          <span className="text-[var(--text-dim)]">—</span>
        ),
      sortable: true,
      sortValue: (r) => r.categoryLabel ?? '',
    },
    {
      key: 'createdAt',
      header: 'التاريخ',
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">{f.relative(r.createdAt)}</span>
      ),
      sortable: true,
      sortValue: (r) => r.createdAt,
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => <RowActions n={r} />,
    },
  ];

  const emptyState = (
    <EmptyState
      icon={<Bell size={18} />}
      title={tab === 'unread' ? 'لا إشعارات غير مقروءة' : 'لا توجد إشعارات'}
      description={
        tab === 'unread'
          ? 'أنت على اطّلاع — لا جديد بانتظارك.'
          : 'ستظهر هنا التنبيهات حول المشاريع والمهام والمعدات والموافقات.'
      }
    />
  );

  const tabs = (
    <div className="flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] p-1">
      <button
        type="button"
        onClick={() => setTab('unread')}
        className={
          'rounded px-3 py-1.5 text-[12px] font-semibold transition-colors ' +
          (tab === 'unread'
            ? 'bg-[var(--accent)] text-white'
            : 'text-[var(--text-muted)] hover:text-[var(--text)]')
        }
      >
        غير مقروء {unreadCount > 0 && <span className="ms-1 tabular">{unreadCount}</span>}
      </button>
      <button
        type="button"
        onClick={() => setTab('all')}
        className={
          'rounded px-3 py-1.5 text-[12px] font-semibold transition-colors ' +
          (tab === 'all'
            ? 'bg-[var(--accent)] text-white'
            : 'text-[var(--text-muted)] hover:text-[var(--text)]')
        }
      >
        الكل <span className="ms-1 tabular">{rows.length}</span>
      </button>
    </div>
  );

  const toolbarExtra = (
    <div className="flex items-center gap-2">
      {tabs}
      {unreadCount > 0 && (
        <button
          type="button"
          disabled={allPending}
          onClick={() => startAll(() => markAllRead())}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] font-semibold text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-50"
        >
          <CheckCheck size={14} />
          علّم الكل مقروء
        </button>
      )}
    </div>
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={20} />}
        title="صندوق الإشعارات فارغ"
        description="ستصلك هنا تنبيهات حول المشاريع والمهام والمعدات والموافقات والمراجعات."
      />
    );
  }

  return (
    <ListWorkspace<NotifRow>
      rows={visible}
      storageKey="notifications"
      getId={(r) => r.id}
      searchText={(r) => `${r.title} ${r.body ?? ''} ${r.categoryLabel ?? ''}`}
      filters={filters}
      columns={columns}
      defaultView="cards"
      renderCard={(r) => <NotifCard n={r} />}
      toolbarExtra={toolbarExtra}
      emptyState={emptyState}
    />
  );
}
