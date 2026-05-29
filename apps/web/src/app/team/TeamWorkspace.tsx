'use client';

import Link from 'next/link';
import { UserSquare2 } from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  Avatar,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';

export interface TeamRow {
  id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
  phone_e164: string | null;
  department_name: string | null;
  job_title: string | null;
  capability_count: number;
  active_projects: number;
  capability_keys: string[] | null;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  on_leave: 'warning',
  inactive: 'neutral',
  invited: 'warning',
  terminated: 'danger',
};

const STATUS_LABEL_AR: Record<string, string> = {
  active: 'نشط',
  on_leave: 'إجازة',
  inactive: 'غير نشط',
  invited: 'مدعو',
  terminated: 'منتهٍ',
};

export function TeamWorkspace({
  people,
  capLabels,
}: {
  people: TeamRow[];
  // skill key → Arabic name, for rendering capability chips client-side
  capLabels: Record<string, string>;
}) {
  const departments = Array.from(
    new Set(people.map((p) => p.department_name ?? 'بدون قسم')),
  ).sort((a, b) => a.localeCompare(b, 'ar'));
  const statuses = Array.from(new Set(people.map((p) => p.status))).filter(Boolean);

  const allFilters: FilterDef<TeamRow>[] = [
    {
      key: 'department',
      label: 'القسم',
      options: departments.map((d) => ({ value: d, label: d })),
      predicate: (row, value) => (row.department_name ?? 'بدون قسم') === value,
    },
    {
      key: 'status',
      label: 'الحالة',
      options: statuses.map((s) => ({ value: s, label: STATUS_LABEL_AR[s] ?? s })),
      predicate: (row, value) => row.status === value,
    },
    {
      key: 'load',
      label: 'الأعباء',
      options: [
        { value: 'overloaded', label: 'محمّل (٤+)' },
        { value: 'idle', label: 'بلا مشاريع' },
      ],
      predicate: (row, value) =>
        value === 'overloaded'
          ? Number(row.active_projects) >= 4
          : Number(row.active_projects) === 0,
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const capChips = (keys: string[] | null, max = 4) => {
    const list = keys ?? [];
    const shown = list.slice(0, max);
    const more = list.length - shown.length;
    return (
      <div className="flex flex-wrap gap-1.5">
        {shown.map((key) => (
          <span
            key={key}
            className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
          >
            {capLabels[key] ?? key}
          </span>
        ))}
        {more > 0 && (
          <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-dim)]">
            +{more}
          </span>
        )}
        {list.length === 0 && (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        )}
      </div>
    );
  };

  const columns: ColumnDef<TeamRow>[] = [
    {
      key: 'name',
      header: 'العضو',
      sortable: true,
      sortValue: (r) => r.display_name,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.display_name} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/team/${r.id}`}
                className="text-[var(--text)] hover:text-[var(--accent)]"
              >
                {r.display_name}
              </Link>
              {r.status !== 'active' && (
                <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'} withDot={false}>
                  {STATUS_LABEL_AR[r.status] ?? r.status}
                </StatusPill>
              )}
            </div>
            <div className="font-mono text-[10px] text-[var(--text-dim)]">
              {r.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'job_title',
      header: 'الدور',
      sortable: true,
      sortValue: (r) => r.job_title ?? '',
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">
          {r.job_title ?? '—'}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'القسم',
      sortable: true,
      sortValue: (r) => r.department_name ?? '',
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">
          {r.department_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'active_projects',
      header: 'مشاريع نشطة',
      sortable: true,
      sortValue: (r) => Number(r.active_projects),
      cell: (r) => (
        <span className="font-mono text-[13px] text-[var(--text)]">
          {r.active_projects}
        </span>
      ),
    },
    {
      key: 'skills',
      header: 'المهارات',
      sortable: true,
      sortValue: (r) => Number(r.capability_count),
      cell: (r) => capChips(r.capability_keys, 3),
    },
  ];

  const renderCard = (r: TeamRow) => (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-5">
      <div className="flex items-start gap-3">
        <Avatar name={r.display_name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/team/${r.id}`}
              className="truncate text-[14px] font-semibold text-[var(--text)] hover:text-[var(--accent)]"
            >
              {r.display_name}
            </Link>
            {r.status !== 'active' && (
              <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'} withDot={false}>
                {STATUS_LABEL_AR[r.status] ?? r.status}
              </StatusPill>
            )}
          </div>
          {r.job_title && (
            <p className="text-[11px] text-[var(--text-muted)]">{r.job_title}</p>
          )}
          <p className="truncate font-mono text-[10px] text-[var(--text-dim)]">
            {r.email}
          </p>
          {r.department_name && (
            <p className="text-[10px] text-[var(--text-dim)]">{r.department_name}</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-3 text-[11px]">
        <div>
          <p className="text-[var(--text-dim)]">المشاريع النشطة</p>
          <p className="mt-0.5 font-mono text-[16px] font-semibold text-[var(--text)]">
            {r.active_projects}
          </p>
        </div>
        <div>
          <p className="text-[var(--text-dim)]">المهارات</p>
          <p className="mt-0.5 font-mono text-[16px] font-semibold text-[var(--text)]">
            {r.capability_count}
          </p>
        </div>
      </div>

      {(r.capability_keys ?? []).length > 0 && (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          {capChips(r.capability_keys, 4)}
        </div>
      )}
    </article>
  );

  const renderCompact = (r: TeamRow) => (
    <Link
      href={`/team/${r.id}`}
      className="flex items-center gap-3 text-[13px] hover:text-[var(--accent)]"
    >
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">
        {r.display_name}
      </span>
      <span className="hidden w-32 shrink-0 truncate text-[11px] text-[var(--text-muted)] sm:inline">
        {r.department_name ?? '—'}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
        {r.active_projects} مشروع
      </span>
      <span className="shrink-0 font-mono text-[11px] text-[var(--text-dim)]">
        {r.capability_count} مهارة
      </span>
    </Link>
  );

  return (
    <ListWorkspace<TeamRow>
      rows={people}
      storageKey="team"
      getId={(r) => r.id}
      searchText={(r) =>
        [
          r.display_name,
          r.email,
          r.job_title,
          r.department_name,
          ...(r.capability_keys ?? []).map((k) => capLabels[k] ?? k),
        ]
          .filter(Boolean)
          .join(' ')
      }
      filters={filters}
      columns={columns}
      renderCard={renderCard}
      renderCompact={renderCompact}
      defaultView="cards"
      emptyState={
        <EmptyState
          icon={<UserSquare2 size={18} />}
          title="لا نتائج"
          description="جرّب تعديل البحث أو الفلاتر."
        />
      }
    />
  );
}
