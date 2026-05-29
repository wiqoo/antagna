'use client';

import Link from 'next/link';
import { Sparkles, MapPin } from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  Avatar,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';

export interface TalentRow {
  id: string;
  code: string;
  displayName: string;
  displayNameEn: string | null;
  contractType: string;
  commissionPct: string | null;
  category: string | null;
  niches: string[] | null;
  languages: string[] | null;
  cityBase: string | null;
  signedContractAt: string | null;
}

const CONTRACT_AR: Record<string, string> = {
  exclusive: 'حصري',
  non_exclusive: 'غير حصري',
  project_based: 'بالمشروع',
  ad_hoc: 'لمرة واحدة',
  unsigned_potential: 'محتمل (بلا عقد)',
};

const CONTRACT_TONE: Record<
  string,
  'accent' | 'success' | 'warning' | 'neutral' | 'info'
> = {
  exclusive: 'accent',
  non_exclusive: 'info',
  project_based: 'neutral',
  ad_hoc: 'neutral',
  unsigned_potential: 'warning',
};

function pct(v: string | null): string {
  return v ? `${Number(v)}%` : '—';
}

export function TalentsWorkspace({ items }: { items: TalentRow[] }) {
  const categories = Array.from(
    new Set(items.map((t) => t.category).filter((c): c is string => !!c)),
  ).sort((a, b) => a.localeCompare(b, 'ar'));
  const contractTypes = Array.from(
    new Set(items.map((t) => t.contractType).filter(Boolean)),
  );
  const cities = Array.from(
    new Set(items.map((t) => t.cityBase).filter((c): c is string => !!c)),
  ).sort((a, b) => a.localeCompare(b, 'ar'));

  const allFilters: FilterDef<TalentRow>[] = [
    {
      key: 'contractType',
      label: 'نوع العقد',
      options: contractTypes.map((c) => ({
        value: c,
        label: CONTRACT_AR[c] ?? c,
      })),
      predicate: (row, value) => row.contractType === value,
    },
    {
      key: 'category',
      label: 'الفئة',
      options: categories.map((c) => ({ value: c, label: c })),
      predicate: (row, value) => row.category === value,
    },
    {
      key: 'city',
      label: 'المدينة',
      options: cities.map((c) => ({ value: c, label: c })),
      predicate: (row, value) => row.cityBase === value,
    },
    {
      key: 'contract',
      label: 'حالة التعاقد',
      options: [
        { value: 'signed', label: 'بعقد موقَّع' },
        { value: 'unsigned', label: 'بلا عقد' },
      ],
      predicate: (row, value) =>
        value === 'signed' ? !!row.signedContractAt : !row.signedContractAt,
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const columns: ColumnDef<TalentRow>[] = [
    {
      key: 'name',
      header: 'الموهبة',
      sortable: true,
      sortValue: (r) => r.displayName,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.displayName} size="sm" />
          <div className="min-w-0">
            <Link
              href={`/talents/${r.id}`}
              className="text-[var(--text)] hover:text-[var(--accent)]"
            >
              {r.displayName}
            </Link>
            <div className="font-mono text-[10px] text-[var(--text-dim)]">
              {r.code}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'الفئة',
      sortable: true,
      sortValue: (r) => r.category ?? '',
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">
          {r.category ?? '—'}
        </span>
      ),
    },
    {
      key: 'niches',
      header: 'المجالات',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {(r.niches ?? []).slice(0, 3).map((n, i) => (
            <span
              key={i}
              className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
            >
              {n}
            </span>
          ))}
          {(r.niches ?? []).length === 0 && (
            <span className="text-[11px] text-[var(--text-dim)]">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'languages',
      header: 'اللغات',
      cell: (r) => (
        <span className="font-mono text-[11px] text-[var(--text-dim)]">
          {(r.languages ?? []).join(' · ') || '—'}
        </span>
      ),
    },
    {
      key: 'commission',
      header: 'العمولة',
      sortable: true,
      sortValue: (r) => Number(r.commissionPct ?? 0),
      cell: (r) => (
        <span className="font-mono text-[12px] text-[var(--text-muted)]">
          {pct(r.commissionPct)}
        </span>
      ),
    },
    {
      key: 'contract',
      header: 'العقد',
      sortable: true,
      sortValue: (r) => CONTRACT_AR[r.contractType] ?? r.contractType,
      cell: (r) => (
        <StatusPill tone={CONTRACT_TONE[r.contractType] ?? 'neutral'} withDot={false}>
          {CONTRACT_AR[r.contractType] ?? r.contractType}
        </StatusPill>
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
  ];

  const renderCard = (r: TalentRow) => (
    <Link
      href={`/talents/${r.id}`}
      className="magnet group block rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4 transition-colors hover:border-[var(--line-strong)]"
    >
      <div className="flex items-start gap-3">
        <Avatar name={r.displayName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">
              {r.displayName}
            </span>
          </div>
          {r.category && (
            <p className="text-[11px] text-[var(--text-muted)]">{r.category}</p>
          )}
          <p className="font-mono text-[10px] text-[var(--text-dim)]">{r.code}</p>
        </div>
        <StatusPill tone={CONTRACT_TONE[r.contractType] ?? 'neutral'} withDot={false}>
          {CONTRACT_AR[r.contractType] ?? r.contractType}
        </StatusPill>
      </div>

      {(r.niches ?? []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1 border-t border-[var(--line)] pt-3">
          {(r.niches ?? []).slice(0, 4).map((n, i) => (
            <span
              key={i}
              className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
            >
              {n}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3 text-[11px] text-[var(--text-muted)]">
        <span>العمولة {pct(r.commissionPct)}</span>
        {r.cityBase && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} className="text-[var(--text-dim)]" />
            {r.cityBase}
          </span>
        )}
      </div>
    </Link>
  );

  const renderCompact = (r: TalentRow) => (
    <Link
      href={`/talents/${r.id}`}
      className="flex items-center gap-3 text-[13px] hover:text-[var(--accent)]"
    >
      <span className="w-24 shrink-0 truncate font-mono text-[10px] text-[var(--text-dim)]">
        {r.code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">
        {r.displayName}
      </span>
      <span className="hidden w-28 shrink-0 truncate text-[11px] text-[var(--text-muted)] sm:inline">
        {r.cityBase ?? '—'}
      </span>
      <span className="shrink-0">
        <StatusPill tone={CONTRACT_TONE[r.contractType] ?? 'neutral'} withDot={false}>
          {CONTRACT_AR[r.contractType] ?? r.contractType}
        </StatusPill>
      </span>
    </Link>
  );

  return (
    <ListWorkspace<TalentRow>
      rows={items}
      storageKey="talents"
      getId={(r) => r.id}
      searchText={(r) =>
        [
          r.code,
          r.displayName,
          r.displayNameEn,
          r.category,
          ...(r.niches ?? []),
          ...(r.languages ?? []),
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
          icon={<Sparkles size={18} />}
          title="لا نتائج"
          description="جرّب تعديل البحث أو الفلاتر."
        />
      }
    />
  );
}
