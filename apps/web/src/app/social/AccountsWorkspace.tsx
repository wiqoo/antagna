'use client';

import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';
import { AtSign, Plus } from 'lucide-react';
import {
  PLATFORM_ICON,
  PLATFORM_LABEL_AR,
  ACCESS_TYPE_LABEL_AR,
  fmtNum,
} from './_shared';

export interface AccountRow {
  id: string;
  code: string;
  ownerLabel: string;
  ownerName: string | null;
  platform: string;
  handle: string;
  accessType: string;
  followerCount: number | null;
  postsCount: number;
  active: boolean;
}

export function AccountsWorkspace({
  rows,
  canEdit,
  onAddClick,
}: {
  rows: AccountRow[];
  canEdit: boolean;
  onAddClick?: () => void;
}) {
  const platforms = Array.from(new Set(rows.map((r) => r.platform))).filter(Boolean);
  const accessTypes = Array.from(new Set(rows.map((r) => r.accessType))).filter(Boolean);

  const allFilters: FilterDef<AccountRow>[] = [
    {
      key: 'platform',
      label: 'المنصة',
      options: platforms.map((p) => ({ value: p, label: PLATFORM_LABEL_AR[p] ?? p })),
      predicate: (row, v) => row.platform === v,
    },
    {
      key: 'access',
      label: 'الوصول',
      options: accessTypes.map((a) => ({ value: a, label: ACCESS_TYPE_LABEL_AR[a] ?? a })),
      predicate: (row, v) => row.accessType === v,
    },
  ];
  const filters = allFilters.filter((f) => f.options.length > 0);

  const columns: ColumnDef<AccountRow>[] = [
    {
      key: 'handle',
      header: 'الحساب',
      sortable: true,
      sortValue: (r) => r.handle,
      cell: (r) => {
        const Icon = PLATFORM_ICON[r.platform] ?? AtSign;
        return (
          <div className="flex items-center gap-2.5">
            <Icon size={15} className="shrink-0 text-[var(--accent)]" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[var(--text)]">@{r.handle}</p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">{r.ownerName ?? r.ownerLabel}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'platform',
      header: 'المنصة',
      sortable: true,
      sortValue: (r) => r.platform,
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">
          {PLATFORM_LABEL_AR[r.platform] ?? r.platform}
        </span>
      ),
    },
    {
      key: 'followers',
      header: 'المتابعون',
      sortable: true,
      sortValue: (r) => r.followerCount ?? 0,
      cell: (r) => (
        <span className="font-mono text-[13px] text-[var(--text)] tabular">
          {fmtNum(r.followerCount)}
        </span>
      ),
    },
    {
      key: 'posts',
      header: 'منشورات',
      sortable: true,
      sortValue: (r) => r.postsCount,
      cell: (r) => (
        <span className="font-mono text-[12px] text-[var(--text-muted)] tabular">{r.postsCount}</span>
      ),
    },
    {
      key: 'access',
      header: 'الوصول',
      sortable: true,
      sortValue: (r) => r.accessType,
      cell: (r) => (
        <StatusPill tone={r.accessType === 'full_admin' ? 'success' : r.accessType === 'no_api' ? 'neutral' : 'info'}>
          {ACCESS_TYPE_LABEL_AR[r.accessType] ?? r.accessType}
        </StatusPill>
      ),
    },
  ];

  const renderCard = (r: AccountRow) => {
    const Icon = PLATFORM_ICON[r.platform] ?? AtSign;
    return (
      <article className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]">
            <Icon size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] text-[var(--text-dim)]">{r.code}</p>
            <p className="truncate text-[14px] font-semibold text-[var(--text)]">@{r.handle}</p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">{r.ownerName ?? r.ownerLabel}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-3 text-[11px]">
          <div>
            <p className="text-[var(--text-dim)]">متابعين</p>
            <p className="mt-0.5 font-mono text-[16px] font-semibold text-[var(--text)]">
              {fmtNum(r.followerCount)}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-dim)]">منشورات</p>
            <p className="mt-0.5 font-mono text-[16px] font-semibold text-[var(--text)]">{r.postsCount}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <StatusPill tone={r.accessType === 'full_admin' ? 'success' : r.accessType === 'no_api' ? 'neutral' : 'info'}>
            {ACCESS_TYPE_LABEL_AR[r.accessType] ?? r.accessType}
          </StatusPill>
          <span className="text-[11px] text-[var(--text-dim)]">{PLATFORM_LABEL_AR[r.platform] ?? r.platform}</span>
        </div>
      </article>
    );
  };

  return (
    <ListWorkspace<AccountRow>
      rows={rows}
      storageKey="social-accounts"
      getId={(r) => r.id}
      searchText={(r) => [r.code, r.handle, r.ownerLabel, r.ownerName, r.platform].filter(Boolean).join(' ')}
      filters={filters}
      columns={columns}
      renderCard={renderCard}
      defaultView="cards"
      emptyState={
        <EmptyState
          icon={<AtSign size={18} />}
          title="لا يوجد حسابات مُدارة"
          description="أضف حساباً مُداراً يدوياً — تتبّع فقط، بدون نشر تلقائي (D-028)."
          action={
            canEdit && onAddClick ? (
              <button
                type="button"
                onClick={onAddClick}
                className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-black hover:opacity-90"
              >
                <Plus size={14} /> إضافة حساب
              </button>
            ) : undefined
          }
        />
      }
    />
  );
}
