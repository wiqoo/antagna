'use client';

import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';
import { Megaphone, ExternalLink } from 'lucide-react';
import {
  PLATFORM_ICON,
  POST_STATUS_LABEL_AR,
  POST_STATUS_TONE,
  FORMAT_LABEL_AR,
  PLATFORM_LABEL_AR,
} from './_shared';
import { updatePostStatus } from './actions';

export interface PostRow {
  id: string;
  code: string;
  title: string;
  format: string;
  status: string;
  platform: string;
  accountHandle: string;
  ownerLabel: string;
  plannedPublishAt: string | null;
  publishedAt: string | null;
  externalPostUrl: string | null;
  views: number | null;
  reachUnique: number | null;
}

const NEXT_STATUS: Record<string, string | null> = {
  idea: 'drafting',
  drafting: 'in_review',
  in_review: 'scheduled',
  scheduled: 'published',
  published: null,
  promoted: null,
  archived: null,
  cancelled: null,
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar', { day: '2-digit', month: 'short' });
}

export function PostsWorkspace({ rows, canEdit }: { rows: PostRow[]; canEdit: boolean }) {
  const statuses = Array.from(new Set(rows.map((r) => r.status))).filter(Boolean);
  const formats = Array.from(new Set(rows.map((r) => r.format))).filter(Boolean);
  const handles = Array.from(new Set(rows.map((r) => r.accountHandle))).filter(Boolean);

  const allFilters: FilterDef<PostRow>[] = [
    {
      key: 'status',
      label: 'الحالة',
      options: statuses.map((s) => ({ value: s, label: POST_STATUS_LABEL_AR[s] ?? s })),
      predicate: (row, v) => row.status === v,
    },
    {
      key: 'format',
      label: 'النوع',
      options: formats.map((f) => ({ value: f, label: FORMAT_LABEL_AR[f] ?? f })),
      predicate: (row, v) => row.format === v,
    },
    {
      key: 'account',
      label: 'الحساب',
      options: handles.map((h) => ({ value: h, label: `@${h}` })),
      predicate: (row, v) => row.accountHandle === v,
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const StatusCell = ({ r }: { r: PostRow }) => {
    const next = NEXT_STATUS[r.status];
    return (
      <div className="flex items-center gap-2">
        <StatusPill tone={POST_STATUS_TONE[r.status] ?? 'neutral'}>
          {POST_STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
        {canEdit && next && (
          <form action={updatePostStatus}>
            <input type="hidden" name="postId" value={r.id} />
            <input type="hidden" name="status" value={next} />
            <button
              type="submit"
              className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              title={`نقل إلى: ${POST_STATUS_LABEL_AR[next] ?? next}`}
            >
              → {POST_STATUS_LABEL_AR[next] ?? next}
            </button>
          </form>
        )}
      </div>
    );
  };

  const columns: ColumnDef<PostRow>[] = [
    {
      key: 'title',
      header: 'العنوان',
      sortable: true,
      sortValue: (r) => r.title,
      cell: (r) => {
        const Icon = PLATFORM_ICON[r.platform];
        return (
          <div className="flex items-center gap-2.5">
            {Icon && <Icon size={14} className="shrink-0 text-[var(--text-dim)]" />}
            <div className="min-w-0">
              <p className="truncate text-[13px] text-[var(--text)]">{r.title}</p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">
                @{r.accountHandle} · {r.ownerLabel}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'format',
      header: 'النوع',
      sortable: true,
      sortValue: (r) => r.format,
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">{FORMAT_LABEL_AR[r.format] ?? r.format}</span>
      ),
    },
    {
      key: 'planned',
      header: 'موعد النشر',
      sortable: true,
      sortValue: (r) => r.plannedPublishAt ?? r.publishedAt ?? '',
      cell: (r) => (
        <span className="font-mono text-[12px] text-[var(--text-muted)]" dir="ltr">
          {fmtDate(r.publishedAt ?? r.plannedPublishAt)}
        </span>
      ),
    },
    {
      key: 'reach',
      header: 'الوصول',
      sortable: true,
      sortValue: (r) => r.reachUnique ?? r.views ?? 0,
      cell: (r) => {
        const v = r.reachUnique ?? r.views;
        return (
          <span className="font-mono text-[12px] text-[var(--text-muted)] tabular">
            {v != null ? new Intl.NumberFormat('en-US').format(v) : '—'}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'الحالة',
      sortable: true,
      sortValue: (r) => POST_STATUS_LABEL_AR[r.status] ?? r.status,
      cell: (r) => <StatusCell r={r} />,
    },
  ];

  const renderCard = (r: PostRow) => {
    const Icon = PLATFORM_ICON[r.platform];
    return (
      <article className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4">
        <div className="flex items-start gap-2.5">
          {Icon && <Icon size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[var(--text)]">{r.title}</p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">
              @{r.accountHandle} · {PLATFORM_LABEL_AR[r.platform] ?? r.platform}
            </p>
          </div>
          {r.externalPostUrl && (
            <a href={r.externalPostUrl} target="_blank" rel="noreferrer" className="text-[var(--text-dim)] hover:text-[var(--accent)]">
              <ExternalLink size={13} />
            </a>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)]">
          <span>{FORMAT_LABEL_AR[r.format] ?? r.format}</span>
          <span className="font-mono" dir="ltr">{fmtDate(r.publishedAt ?? r.plannedPublishAt)}</span>
        </div>
        <StatusCell r={r} />
      </article>
    );
  };

  return (
    <ListWorkspace<PostRow>
      rows={rows}
      storageKey="social-posts"
      getId={(r) => r.id}
      searchText={(r) => [r.code, r.title, r.accountHandle, r.ownerLabel, r.format].filter(Boolean).join(' ')}
      filters={filters}
      columns={columns}
      renderCard={renderCard}
      defaultView="table"
      emptyState={
        <EmptyState
          icon={<Megaphone size={18} />}
          title="لا يوجد محتوى مسجّل"
          description="استخدم النموذج أعلاه لإضافة فكرة أو منشور مجدول."
        />
      }
    />
  );
}
