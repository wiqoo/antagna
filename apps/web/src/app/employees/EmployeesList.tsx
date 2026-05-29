'use client';

import Link from 'next/link';
import { UserSquare2, Briefcase } from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  Avatar,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';

export interface EmployeeRow {
  profileId: string;
  displayName: string;
  displayNameEn: string | null;
  email: string;
  status: string;
  jobTitle: string | null;
  departmentName: string | null;
  employmentType: string | null;
  nationality: string | null;
  hireDate: string | null;
  hasRecord: boolean;
  /** Pre-masked on the server: real number for access.manage, else null. */
  monthlySalary: number | null;
  monthlySalaryCurrency: string | null;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  on_leave: 'warning',
  invited: 'neutral',
  inactive: 'neutral',
  terminated: 'danger',
};

const STATUS_LABEL_AR: Record<string, string> = {
  active: 'نشط',
  on_leave: 'في إجازة',
  invited: 'مدعو',
  inactive: 'غير نشط',
  terminated: 'منتهٍ',
};

const EMP_TYPE_AR: Record<string, string> = {
  full_time: 'دوام كامل',
  part_time: 'دوام جزئي',
  freelancer: 'فريلانسر',
};

export function EmployeesList({
  rows,
  canSeeSalary,
}: {
  rows: EmployeeRow[];
  canSeeSalary: boolean;
}) {
  const departments = Array.from(
    new Set(rows.map((r) => r.departmentName).filter((d): d is string => !!d)),
  ).sort((a, b) => a.localeCompare(b, 'ar'));
  const empTypes = Array.from(
    new Set(rows.map((r) => r.employmentType).filter((t): t is string => !!t)),
  );
  const statuses = Array.from(new Set(rows.map((r) => r.status))).filter(Boolean);

  const allFilters: FilterDef<EmployeeRow>[] = [
    {
      key: 'status',
      label: 'الحالة',
      options: statuses.map((s) => ({ value: s, label: STATUS_LABEL_AR[s] ?? s })),
      predicate: (row, value) => row.status === value,
    },
    {
      key: 'department',
      label: 'القسم',
      options: departments.map((d) => ({ value: d, label: d })),
      predicate: (row, value) => row.departmentName === value,
    },
    {
      key: 'employment',
      label: 'نوع التوظيف',
      options: empTypes.map((t) => ({ value: t, label: EMP_TYPE_AR[t] ?? t })),
      predicate: (row, value) => row.employmentType === value,
    },
    {
      key: 'record',
      label: 'الملف',
      options: [
        { value: 'yes', label: 'له ملف HR' },
        { value: 'no', label: 'بلا ملف' },
      ],
      predicate: (row, value) => (value === 'yes' ? row.hasRecord : !row.hasRecord),
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const fmtSalary = (r: EmployeeRow): string => {
    if (!canSeeSalary) return '••••';
    if (r.monthlySalary == null) return '—';
    return new Intl.NumberFormat('en-US').format(r.monthlySalary);
  };

  const columns: ColumnDef<EmployeeRow>[] = [
    {
      key: 'name',
      header: 'الموظف',
      sortable: true,
      sortValue: (r) => r.displayName,
      cell: (r) => (
        <Link href={`/employees/${r.profileId}`} className="flex items-center gap-2.5 group">
          <Avatar name={r.displayName} size="sm" />
          <div className="min-w-0">
            <span className="block truncate text-[13px] text-[var(--text)] group-hover:text-[var(--accent)]">
              {r.displayName}
            </span>
            <span className="block truncate font-mono text-[10px] text-[var(--text-dim)]" dir="ltr">
              {r.email}
            </span>
          </div>
        </Link>
      ),
    },
    {
      key: 'jobTitle',
      header: 'المسمى',
      sortable: true,
      sortValue: (r) => r.jobTitle ?? '',
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">{r.jobTitle ?? '—'}</span>
      ),
    },
    {
      key: 'department',
      header: 'القسم',
      sortable: true,
      sortValue: (r) => r.departmentName ?? '',
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">{r.departmentName ?? '—'}</span>
      ),
    },
    {
      key: 'employment',
      header: 'التوظيف',
      sortable: true,
      sortValue: (r) => r.employmentType ?? '',
      cell: (r) =>
        r.employmentType ? (
          <StatusPill tone="neutral" withDot={false}>
            {EMP_TYPE_AR[r.employmentType] ?? r.employmentType}
          </StatusPill>
        ) : (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ),
    },
    {
      key: 'salary',
      header: 'الراتب',
      sortable: true,
      sortValue: (r) => r.monthlySalary ?? 0,
      cell: (r) => {
        const s = fmtSalary(r);
        return s === '—' ? (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ) : (
          <span className="font-mono text-[12px] text-[var(--text-muted)]">
            {s}{' '}
            <span className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
              {r.monthlySalaryCurrency ?? 'SAR'}
            </span>
          </span>
        );
      },
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

  const renderCard = (r: EmployeeRow) => (
    <Link
      href={`/employees/${r.profileId}`}
      className="magnet group block rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4 transition-colors hover:border-[var(--line-strong)]"
    >
      <div className="flex items-center gap-3">
        <Avatar name={r.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
            {r.displayName}
          </p>
          <p className="truncate text-[11px] text-[var(--text-muted)]">{r.jobTitle ?? '—'}</p>
        </div>
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span className="truncate">{r.departmentName ?? '—'}</span>
        {r.employmentType && (
          <span className="uppercase tracking-[0.14em] text-[var(--text-dim)]">
            {EMP_TYPE_AR[r.employmentType] ?? r.employmentType}
          </span>
        )}
      </div>
    </Link>
  );

  const renderCompact = (r: EmployeeRow) => (
    <Link
      href={`/employees/${r.profileId}`}
      className="flex items-center gap-3 text-[13px] hover:text-[var(--accent)]"
    >
      <Avatar name={r.displayName} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">{r.displayName}</span>
      <span className="hidden w-32 shrink-0 truncate text-[11px] text-[var(--text-muted)] sm:inline">
        {r.jobTitle ?? '—'}
      </span>
      <span className="shrink-0">
        <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
          {STATUS_LABEL_AR[r.status] ?? r.status}
        </StatusPill>
      </span>
    </Link>
  );

  return (
    <ListWorkspace<EmployeeRow>
      rows={rows}
      storageKey="employees"
      getId={(r) => r.profileId}
      searchText={(r) =>
        [r.displayName, r.displayNameEn, r.email, r.jobTitle, r.departmentName, r.nationality]
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
          icon={<UserSquare2 size={18} />}
          title="لا موظفين"
          description="جرّب تعديل البحث أو الفلاتر. تُنشأ ملفات الموظفين من المنصات المدعوة."
        />
      }
    />
  );
}
