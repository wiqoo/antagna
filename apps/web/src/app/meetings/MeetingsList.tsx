'use client';

import Link from 'next/link';
import { CalendarDays, Users, Plus, CheckSquare } from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';

export interface MeetingRow {
  id: string;
  meetingTitle: string | null;
  meetingDate: string | null;
  attendeesText: string | null;
  noteContent: string | null;
  source: string;
  projectId: string | null;
  projectCode: string | null;
  projectTitle: string | null;
  clientId: string | null;
  clientNameAr: string | null;
  actionItemCount: number;
  openActionItemCount: number;
}

const SOURCE_LABEL_AR: Record<string, string> = {
  manual: 'يدوي',
  gemini: 'Gemini',
  transcription_other: 'تفريغ',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function attendeeCount(txt: string | null): number {
  if (!txt) return 0;
  return txt
    .split(/[,،\n]/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

export function MeetingsList({
  rows,
  initialFilters,
}: {
  rows: MeetingRow[];
  initialFilters?: Record<string, string>;
}) {
  const sources = Array.from(new Set(rows.map((r) => r.source))).filter(Boolean);
  const clients = Array.from(
    new Map(
      rows
        .filter((r) => r.clientId && r.clientNameAr)
        .map((r) => [r.clientId!, r.clientNameAr!] as const),
    ).entries(),
  );
  const projects = Array.from(
    new Map(
      rows
        .filter((r) => r.projectId && r.projectCode)
        .map((r) => [r.projectId!, r.projectCode!] as const),
    ).entries(),
  );

  const allFilters: FilterDef<MeetingRow>[] = [
    {
      key: 'source',
      label: 'المصدر',
      options: sources.map((s) => ({ value: s, label: SOURCE_LABEL_AR[s] ?? s })),
      predicate: (row, value) => row.source === value,
    },
    {
      key: 'client',
      label: 'العميل',
      options: clients.map(([id, name]) => ({ value: id, label: name })),
      predicate: (row, value) => row.clientId === value,
    },
    {
      key: 'project',
      label: 'المشروع',
      options: projects.map(([id, code]) => ({ value: id, label: code })),
      predicate: (row, value) => row.projectId === value,
    },
    {
      key: 'hasActions',
      label: 'المهام',
      options: [{ value: 'open', label: 'فيه مهام مفتوحة' }],
      predicate: (row, value) => (value === 'open' ? row.openActionItemCount > 0 : true),
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const columns: ColumnDef<MeetingRow>[] = [
    {
      key: 'date',
      header: 'التاريخ',
      sortable: true,
      sortValue: (r) => r.meetingDate ?? '',
      cell: (r) => (
        <Link
          href={`/meetings/${r.id}`}
          className="font-mono text-[11px] text-[var(--text-dim)] hover:text-[var(--accent)]"
          dir="ltr"
        >
          {fmtDate(r.meetingDate)}
        </Link>
      ),
    },
    {
      key: 'title',
      header: 'العنوان',
      sortable: true,
      sortValue: (r) => r.meetingTitle ?? '',
      cell: (r) => (
        <Link href={`/meetings/${r.id}`} className="group block min-w-0">
          <span className="block truncate text-[13px] text-[var(--text)] group-hover:text-[var(--accent)]">
            {r.meetingTitle ?? '(بدون عنوان)'}
          </span>
          {r.clientNameAr && (
            <span className="text-[11px] text-[var(--text-dim)]">{r.clientNameAr}</span>
          )}
        </Link>
      ),
    },
    {
      key: 'attendees',
      header: 'الحضور',
      sortable: true,
      sortValue: (r) => attendeeCount(r.attendeesText),
      cell: (r) => {
        const n = attendeeCount(r.attendeesText);
        return n === 0 ? (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
            <Users size={11} /> {n}
          </span>
        );
      },
    },
    {
      key: 'project',
      header: 'المشروع',
      sortable: true,
      sortValue: (r) => r.projectCode ?? '',
      cell: (r) =>
        r.projectId && r.projectCode ? (
          <Link
            href={`/projects/${r.projectId}`}
            className="font-mono text-[11px] text-[var(--accent)] hover:underline"
          >
            {r.projectCode}
          </Link>
        ) : (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ),
    },
    {
      key: 'actions',
      header: 'مهام',
      sortable: true,
      sortValue: (r) => r.openActionItemCount,
      cell: (r) =>
        r.actionItemCount === 0 ? (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ) : (
          <StatusPill tone={r.openActionItemCount > 0 ? 'warning' : 'success'}>
            {r.openActionItemCount > 0
              ? `${r.openActionItemCount} مفتوحة`
              : `${r.actionItemCount} ✓`}
          </StatusPill>
        ),
    },
  ];

  const renderCard = (r: MeetingRow) => (
    <Link
      href={`/meetings/${r.id}`}
      className="magnet group block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4 transition-colors hover:border-[var(--line-strong)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--text-dim)]" dir="ltr">
          <CalendarDays size={11} /> {fmtDate(r.meetingDate)}
        </span>
        <span className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
          {SOURCE_LABEL_AR[r.source] ?? r.source}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-[14px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
        {r.meetingTitle ?? '(بدون عنوان)'}
      </p>
      {r.noteContent && (
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
          {r.noteContent}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3 text-[11px] text-[var(--text-muted)]">
        {r.clientNameAr && <span>{r.clientNameAr}</span>}
        {r.projectCode && (
          <span className="font-mono text-[var(--accent)]">{r.projectCode}</span>
        )}
        {attendeeCount(r.attendeesText) > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users size={10} /> {attendeeCount(r.attendeesText)}
          </span>
        )}
        {r.actionItemCount > 0 && (
          <span className="ms-auto inline-flex items-center gap-1">
            <CheckSquare size={10} />
            {r.openActionItemCount > 0
              ? `${r.openActionItemCount}/${r.actionItemCount}`
              : `${r.actionItemCount} ✓`}
          </span>
        )}
      </div>
    </Link>
  );

  const renderCompact = (r: MeetingRow) => (
    <Link
      href={`/meetings/${r.id}`}
      className="flex items-center gap-3 text-[13px] hover:text-[var(--accent)]"
    >
      <span className="w-24 shrink-0 font-mono text-[10px] text-[var(--text-dim)]" dir="ltr">
        {fmtDate(r.meetingDate)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">
        {r.meetingTitle ?? '(بدون عنوان)'}
      </span>
      {r.clientNameAr && (
        <span className="hidden w-28 shrink-0 truncate text-[11px] text-[var(--text-muted)] sm:inline">
          {r.clientNameAr}
        </span>
      )}
      {r.openActionItemCount > 0 && (
        <span className="shrink-0">
          <StatusPill tone="warning">{r.openActionItemCount}</StatusPill>
        </span>
      )}
    </Link>
  );

  return (
    <ListWorkspace<MeetingRow>
      rows={rows}
      storageKey="meetings"
      getId={(r) => r.id}
      searchText={(r) =>
        [r.meetingTitle, r.noteContent, r.attendeesText, r.clientNameAr, r.projectCode, r.projectTitle]
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
          icon={<CalendarDays size={18} />}
          title="لا نتائج"
          description="جرّب تعديل البحث أو الفلاتر، أو سجّل محضر اجتماع جديد."
          action={
            <Link
              href="/meetings/new"
              className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus size={14} />
              محضر جديد
            </Link>
          }
        />
      }
    />
  );
}
