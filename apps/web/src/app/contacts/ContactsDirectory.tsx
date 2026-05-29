'use client';

import Link from 'next/link';
import { Mail, Phone, MessageCircle, UserPlus, Star, Crown } from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  Avatar,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';

export interface ContactRow {
  id: string;
  fullName: string;
  fullNameAr: string | null;
  jobTitle: string | null;
  department: string | null;
  isPrimary: boolean;
  isDecisionMaker: boolean;
  clientId: string;
  clientNameAr: string | null;
  clientNameEn: string | null;
  clientCode: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
}

function clientLabel(r: ContactRow): string {
  return r.clientNameAr ?? r.clientNameEn ?? r.clientCode ?? '—';
}

export function ContactsDirectory({
  rows,
  initialFilters,
}: {
  rows: ContactRow[];
  initialFilters?: Record<string, string>;
}) {
  // Client filter options derived from the actual data (deduped, sorted).
  const clientOptions = Array.from(
    new Map(rows.map((r) => [r.clientId, clientLabel(r)])).entries(),
  )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'));

  const allFilters: FilterDef<ContactRow>[] = [
    {
      key: 'client',
      label: 'العميل',
      options: clientOptions,
      predicate: (row, value) => row.clientId === value,
    },
    {
      key: 'flag',
      label: 'التصنيف',
      options: [
        { value: 'primary', label: 'جهة أساسية' },
        { value: 'decision', label: 'صاحب قرار' },
      ],
      predicate: (row, value) =>
        value === 'primary' ? row.isPrimary : row.isDecisionMaker,
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const columns: ColumnDef<ContactRow>[] = [
    {
      key: 'name',
      header: 'الاسم',
      sortable: true,
      sortValue: (r) => r.fullName,
      cell: (r) => (
        <Link href={`/contacts/${r.id}`} className="flex items-center gap-3 hover:text-[var(--accent)]">
          <Avatar name={r.fullName} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[var(--text)]">
              <span className="truncate">{r.fullName}</span>
              {r.isPrimary && <Star size={11} className="shrink-0 text-[var(--accent)]" />}
              {r.isDecisionMaker && <Crown size={11} className="shrink-0 text-[var(--warning)]" />}
            </div>
            {r.jobTitle && (
              <div className="mt-0.5 truncate text-[11px] text-[var(--text-dim)]">{r.jobTitle}</div>
            )}
          </div>
        </Link>
      ),
    },
    {
      key: 'client',
      header: 'العميل',
      sortable: true,
      sortValue: (r) => clientLabel(r),
      cell: (r) => (
        <Link
          href={`/clients/${r.clientId}`}
          className="text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          {clientLabel(r)}
        </Link>
      ),
    },
    {
      key: 'email',
      header: 'البريد',
      sortable: true,
      sortValue: (r) => r.email ?? '',
      cell: (r) =>
        r.email ? (
          <a
            href={`mailto:${r.email}`}
            className="font-mono text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)]"
          >
            {r.email}
          </a>
        ) : (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        ),
    },
    {
      key: 'phone',
      header: 'الهاتف',
      sortable: true,
      sortValue: (r) => r.phone ?? r.whatsapp ?? '',
      cell: (r) => {
        const v = r.phone ?? r.whatsapp;
        return v ? (
          <a
            href={`tel:${v}`}
            dir="ltr"
            className="font-mono text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)]"
          >
            {v}
          </a>
        ) : (
          <span className="text-[11px] text-[var(--text-dim)]">—</span>
        );
      },
    },
    {
      key: 'flags',
      header: 'التصنيف',
      sortable: false,
      cell: (r) => (
        <div className="flex flex-wrap gap-1.5">
          {r.isPrimary && (
            <StatusPill tone="accent" withDot={false}>
              أساسي
            </StatusPill>
          )}
          {r.isDecisionMaker && (
            <StatusPill tone="warning" withDot={false}>
              صاحب قرار
            </StatusPill>
          )}
          {!r.isPrimary && !r.isDecisionMaker && (
            <span className="text-[11px] text-[var(--text-dim)]">—</span>
          )}
        </div>
      ),
    },
  ];

  const renderCard = (r: ContactRow) => (
    <Link
      href={`/contacts/${r.id}`}
      className="magnet group block rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4 transition-colors hover:border-[var(--line-strong)]"
    >
      <div className="flex items-start gap-3">
        <Avatar name={r.fullName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[14px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
              {r.fullName}
            </p>
            {r.isPrimary && <Star size={12} className="shrink-0 text-[var(--accent)]" />}
            {r.isDecisionMaker && <Crown size={12} className="shrink-0 text-[var(--warning)]" />}
          </div>
          {r.jobTitle && (
            <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{r.jobTitle}</p>
          )}
          <p className="mt-1 truncate text-[11px] text-[var(--text-dim)]">{clientLabel(r)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[var(--line)] pt-3 text-[11px]">
        {r.email && (
          <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
            <Mail size={11} className="text-[var(--text-dim)]" />
            <span className="font-mono">{r.email}</span>
          </span>
        )}
        {r.phone && (
          <span dir="ltr" className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
            <Phone size={11} className="text-[var(--text-dim)]" />
            <span className="font-mono">{r.phone}</span>
          </span>
        )}
        {r.whatsapp && (
          <span dir="ltr" className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
            <MessageCircle size={11} className="text-[var(--text-dim)]" />
            <span className="font-mono">{r.whatsapp}</span>
          </span>
        )}
        {!r.email && !r.phone && !r.whatsapp && (
          <span className="text-[var(--text-dim)]">لا وسائل اتصال مسجّلة</span>
        )}
      </div>
    </Link>
  );

  const renderCompact = (r: ContactRow) => (
    <Link
      href={`/contacts/${r.id}`}
      className="flex items-center gap-3 text-[13px] hover:text-[var(--accent)]"
    >
      <Avatar name={r.fullName} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">
        {r.fullName}
        {r.jobTitle && <span className="text-[var(--text-dim)]"> · {r.jobTitle}</span>}
      </span>
      <span className="hidden w-40 shrink-0 truncate text-[11px] text-[var(--text-muted)] sm:inline">
        {clientLabel(r)}
      </span>
      {r.email && (
        <span className="hidden w-48 shrink-0 truncate font-mono text-[11px] text-[var(--text-muted)] md:inline">
          {r.email}
        </span>
      )}
    </Link>
  );

  return (
    <ListWorkspace<ContactRow>
      rows={rows}
      storageKey="contacts"
      getId={(r) => r.id}
      searchText={(r) =>
        [
          r.fullName,
          r.fullNameAr,
          r.jobTitle,
          r.department,
          clientLabel(r),
          r.email,
          r.phone,
          r.whatsapp,
        ]
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
          icon={<UserPlus size={18} />}
          title="لا نتائج"
          description="جرّب تعديل البحث أو الفلاتر، أو أضف جهة اتصال جديدة."
          action={
            <Link
              href="/contacts/new"
              className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <UserPlus size={14} />
              جهة اتصال جديدة
            </Link>
          }
        />
      }
    />
  );
}
