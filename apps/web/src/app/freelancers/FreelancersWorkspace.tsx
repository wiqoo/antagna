'use client';

import Link from 'next/link';
import { Users, Star, MapPin, Sparkles } from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  Avatar,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';

export interface FreelancerRow {
  id: string;
  code: string;
  fullName: string;
  fullNameAr: string | null;
  specialties: string[] | null;
  cityBase: string | null;
  defaultRateSar: string | null;
  defaultRateUnit: string | null;
  projectsCompleted: number;
  averageRating: string | null;
  lastWorkedAt: string | null;
  preferred: boolean;
}

const RATE_UNIT_AR: Record<string, string> = {
  per_day: '/ يوم',
  per_project: '/ مشروع',
  per_hour: '/ ساعة',
};

function idleDays(last: string | null): number | null {
  if (!last) return null;
  return Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
}

function rateLabel(r: FreelancerRow): string {
  if (!r.defaultRateSar) return '—';
  return `${Number(r.defaultRateSar).toLocaleString('en-US')} ${
    RATE_UNIT_AR[r.defaultRateUnit ?? ''] ?? ''
  }`;
}

export function FreelancersWorkspace({ items }: { items: FreelancerRow[] }) {
  const specialties = Array.from(
    new Set(items.flatMap((f) => f.specialties ?? []).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'ar'));
  const cities = Array.from(
    new Set(items.map((f) => f.cityBase).filter((c): c is string => !!c)),
  ).sort((a, b) => a.localeCompare(b, 'ar'));

  const allFilters: FilterDef<FreelancerRow>[] = [
    {
      key: 'preferred',
      label: 'مفضّل',
      options: [{ value: 'yes', label: 'مفضّلون' }],
      predicate: (row) => row.preferred,
    },
    {
      key: 'idle',
      label: 'النشاط',
      options: [
        { value: 'idle', label: 'غير نشطين (٩٠+ يوماً)' },
        { value: 'active', label: 'نشطون' },
      ],
      predicate: (row, value) => {
        const d = idleDays(row.lastWorkedAt);
        const isIdle = d === null || d >= 90;
        return value === 'idle' ? isIdle : !isIdle;
      },
    },
    {
      key: 'specialty',
      label: 'التخصص',
      options: specialties.map((s) => ({ value: s, label: s })),
      predicate: (row, value) => (row.specialties ?? []).includes(value),
    },
    {
      key: 'city',
      label: 'المدينة',
      options: cities.map((c) => ({ value: c, label: c })),
      predicate: (row, value) => row.cityBase === value,
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const columns: ColumnDef<FreelancerRow>[] = [
    {
      key: 'name',
      header: 'الفريلانسر',
      sortable: true,
      sortValue: (r) => r.fullNameAr ?? r.fullName,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.fullNameAr ?? r.fullName} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/freelancers/${r.id}`}
                className="text-[var(--text)] hover:text-[var(--accent)]"
              >
                {r.fullNameAr ?? r.fullName}
              </Link>
              {r.preferred && (
                <Sparkles size={11} className="text-[var(--accent)]" />
              )}
            </div>
            <span className="font-mono text-[10px] text-[var(--text-dim)]">
              {r.code}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'specialties',
      header: 'التخصصات',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {(r.specialties ?? []).slice(0, 3).map((s, i) => (
            <span
              key={i}
              className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
            >
              {s}
            </span>
          ))}
          {(r.specialties ?? []).length === 0 && (
            <span className="text-[11px] text-[var(--text-dim)]">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'city',
      header: 'المدينة',
      sortable: true,
      sortValue: (r) => r.cityBase ?? '',
      cell: (r) =>
        r.cityBase ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
            <MapPin size={11} className="text-[var(--text-dim)]" />
            {r.cityBase}
          </span>
        ) : (
          <span className="text-[12px] text-[var(--text-muted)]">—</span>
        ),
    },
    {
      key: 'rate',
      header: 'السعر',
      sortable: true,
      sortValue: (r) => Number(r.defaultRateSar ?? 0),
      cell: (r) => (
        <span className="font-mono text-[12px] text-[var(--text-muted)]">
          {rateLabel(r)}
        </span>
      ),
    },
    {
      key: 'rating',
      header: 'التقييم',
      sortable: true,
      sortValue: (r) => Number(r.averageRating ?? 0),
      cell: (r) =>
        r.averageRating ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text)]">
            <Star size={11} className="fill-[var(--accent)] text-[var(--accent)]" />
            {Number(r.averageRating).toFixed(1)}
          </span>
        ) : (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ),
    },
    {
      key: 'projects',
      header: 'مشاريع',
      sortable: true,
      sortValue: (r) => r.projectsCompleted,
      cell: (r) => (
        <span className="font-mono text-[12px] text-[var(--text-muted)]">
          {r.projectsCompleted}
        </span>
      ),
    },
    {
      key: 'lastWorked',
      header: 'آخر عمل',
      sortable: true,
      sortValue: (r) =>
        r.lastWorkedAt ? new Date(r.lastWorkedAt).getTime() : 0,
      cell: (r) => {
        const d = idleDays(r.lastWorkedAt);
        return r.lastWorkedAt ? (
          <StatusPill tone={d !== null && d >= 90 ? 'warning' : 'neutral'} withDot={false}>
            {d}ي
          </StatusPill>
        ) : (
          <span className="text-[11px] text-[var(--text-dim)]">لم يعمل</span>
        );
      },
    },
  ];

  const renderCard = (r: FreelancerRow) => {
    const d = idleDays(r.lastWorkedAt);
    return (
      <Link
        href={`/freelancers/${r.id}`}
        className="magnet group block rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4 transition-colors hover:border-[var(--line-strong)]"
      >
        <div className="flex items-start gap-3">
          <Avatar name={r.fullNameAr ?? r.fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[14px] font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">
                {r.fullNameAr ?? r.fullName}
              </span>
              {r.preferred && (
                <Sparkles size={12} className="shrink-0 text-[var(--accent)]" />
              )}
            </div>
            <p className="font-mono text-[10px] text-[var(--text-dim)]">{r.code}</p>
            {r.cityBase && (
              <p className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <MapPin size={11} className="text-[var(--text-dim)]" />
                {r.cityBase}
              </p>
            )}
          </div>
          {r.averageRating && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-[var(--text)]">
              <Star size={11} className="fill-[var(--accent)] text-[var(--accent)]" />
              {Number(r.averageRating).toFixed(1)}
            </span>
          )}
        </div>

        {(r.specialties ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1 border-t border-[var(--line)] pt-3">
            {(r.specialties ?? []).slice(0, 4).map((s, i) => (
              <span
                key={i}
                className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3 text-[11px] text-[var(--text-muted)]">
          <span>{rateLabel(r)}</span>
          <span>
            {r.projectsCompleted} مشروع
            {r.lastWorkedAt && d !== null && d >= 90 && (
              <span className="ms-2 text-[var(--warning,#d97706)]">غير نشط</span>
            )}
          </span>
        </div>
      </Link>
    );
  };

  const renderCompact = (r: FreelancerRow) => (
    <Link
      href={`/freelancers/${r.id}`}
      className="flex items-center gap-3 text-[13px] hover:text-[var(--accent)]"
    >
      <span className="w-24 shrink-0 truncate font-mono text-[10px] text-[var(--text-dim)]">
        {r.code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">
        {r.fullNameAr ?? r.fullName}
        {r.preferred && (
          <Sparkles size={10} className="ms-1.5 inline text-[var(--accent)]" />
        )}
      </span>
      <span className="hidden w-28 shrink-0 truncate text-[11px] text-[var(--text-muted)] sm:inline">
        {r.cityBase ?? '—'}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
        {r.projectsCompleted} مشروع
      </span>
    </Link>
  );

  return (
    <ListWorkspace<FreelancerRow>
      rows={items}
      storageKey="freelancers"
      getId={(r) => r.id}
      searchText={(r) =>
        [
          r.code,
          r.fullName,
          r.fullNameAr,
          ...(r.specialties ?? []),
          r.cityBase,
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
          icon={<Users size={18} />}
          title="لا نتائج"
          description="جرّب تعديل البحث أو الفلاتر."
        />
      }
    />
  );
}
