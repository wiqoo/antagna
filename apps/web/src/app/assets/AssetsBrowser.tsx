'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  ExternalLink,
  Trash2,
  Plus,
  Link2,
  FolderOpen,
} from 'lucide-react';
import {
  ListWorkspace,
  StatusPill,
  EmptyState,
  FileUpload,
  type FilterDef,
  type ColumnDef,
} from '@antagna/ui';
import { setAssetMeta, addExternalAsset, deleteCompanyAsset } from './actions';
import {
  ASSET_CATEGORIES,
  COMPANY_ASSET_ENTITY,
  COMPANY_ASSET_ID,
} from './constants';

export interface AssetRow {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  externalUrl: string | null;
  /** Where this file is attached. 'company_asset' = company-level register. */
  entityType: string;
  /** Parsed category tag from description ("contract" / "license" / …). */
  category: string;
  /** Free-text note (description minus the [category] tag). */
  note: string | null;
  uploadedByName: string | null;
  createdAt: string;
  /** True when this is a company-level asset the user can edit/delete here. */
  isCompany: boolean;
}

const CATEGORY_LABEL_AR: Record<string, string> = {
  contract: 'عقود',
  license: 'تراخيص',
  insurance: 'تأمين',
  registration: 'سجلات',
  brand: 'هوية',
  finance: 'مالية',
  hr: 'موارد بشرية',
  other: 'أخرى',
  '': 'غير مصنّف',
};

const ENTITY_LABEL_AR: Record<string, string> = {
  company_asset: 'أصول الشركة',
  project: 'مشروع',
  client: 'عميل',
  equipment: 'معدّة',
  contact: 'جهة اتصال',
  brief: 'بريف',
  repair: 'صيانة',
};

function entityLabel(t: string): string {
  return ENTITY_LABEL_AR[t] ?? t;
}

function fileGroup(mime: string): 'image' | 'pdf' | 'sheet' | 'archive' | 'link' | 'doc' {
  if (mime === 'text/uri-list') return 'link';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv') return 'sheet';
  if (mime.includes('zip') || mime.includes('compress') || mime.includes('tar')) return 'archive';
  return 'doc';
}

function FileGlyph({ mime }: { mime: string }) {
  const g = fileGroup(mime);
  const cls = 'text-[var(--text-dim)]';
  if (g === 'link') return <Link2 size={15} className={cls} />;
  if (g === 'image') return <FileImage size={15} className={cls} />;
  if (g === 'sheet') return <FileSpreadsheet size={15} className={cls} />;
  if (g === 'archive') return <FileArchive size={15} className={cls} />;
  if (g === 'pdf') return <FileText size={15} className="text-[var(--danger)]" />;
  return <FileIcon size={15} className={cls} />;
}

function fmtSize(n: number): string {
  if (!n || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function openAsset(row: AssetRow) {
  if (row.storageProvider === 'external_url' && row.externalUrl) {
    window.open(row.externalUrl, '_blank', 'noopener');
    return;
  }
  const res = await fetch(`/api/upload?attachmentId=${row.id}`);
  if (!res.ok) return;
  const { url } = (await res.json()) as { url: string };
  if (url) window.open(url, '_blank', 'noopener');
}

export function AssetsBrowser({
  rows,
  canManage,
}: {
  rows: AssetRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const categories = Array.from(new Set(rows.map((r) => r.category))).sort();
  const entityTypes = Array.from(new Set(rows.map((r) => r.entityType))).sort();

  const allFilters: FilterDef<AssetRow>[] = [
    {
      key: 'category',
      label: 'التصنيف',
      options: categories.map((c) => ({ value: c, label: CATEGORY_LABEL_AR[c] ?? c })),
      predicate: (row, value) => row.category === value,
    },
    {
      key: 'entityType',
      label: 'المصدر',
      options: entityTypes.map((e) => ({ value: e, label: entityLabel(e) })),
      predicate: (row, value) => row.entityType === value,
    },
    {
      key: 'kind',
      label: 'النوع',
      options: [
        { value: 'link', label: 'رابط خارجي' },
        { value: 'image', label: 'صور' },
        { value: 'pdf', label: 'PDF' },
        { value: 'sheet', label: 'جداول' },
        { value: 'doc', label: 'مستندات' },
      ],
      predicate: (row, value) => fileGroup(row.mimeType) === value,
    },
  ];
  const filters = allFilters.filter((f) => (f.options?.length ?? 0) > 0);

  const columns: ColumnDef<AssetRow>[] = [
    {
      key: 'filename',
      header: 'الملف',
      sortable: true,
      sortValue: (r) => r.filename,
      cell: (r) => (
        <button
          type="button"
          onClick={() => openAsset(r)}
          className="flex items-center gap-2.5 text-start hover:text-[var(--accent)]"
        >
          <FileGlyph mime={r.mimeType} />
          <span className="truncate text-[13px] text-[var(--text)]">{r.filename}</span>
          {r.storageProvider === 'external_url' && (
            <ExternalLink size={11} className="shrink-0 text-[var(--text-dim)]" />
          )}
        </button>
      ),
    },
    {
      key: 'category',
      header: 'التصنيف',
      sortable: true,
      sortValue: (r) => r.category,
      cell: (r) => (
        <StatusPill tone="info" withDot={false}>
          {CATEGORY_LABEL_AR[r.category] ?? r.category}
        </StatusPill>
      ),
    },
    {
      key: 'source',
      header: 'المصدر',
      sortable: true,
      sortValue: (r) => r.entityType,
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">{entityLabel(r.entityType)}</span>
      ),
    },
    {
      key: 'size',
      header: 'الحجم',
      sortable: true,
      sortValue: (r) => r.sizeBytes,
      cell: (r) => (
        <span className="font-mono text-[11px] text-[var(--text-dim)]">{fmtSize(r.sizeBytes)}</span>
      ),
    },
    {
      key: 'uploadedBy',
      header: 'بواسطة',
      sortable: true,
      sortValue: (r) => r.uploadedByName ?? '',
      cell: (r) => (
        <span className="text-[12px] text-[var(--text-muted)]">{r.uploadedByName ?? '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'التاريخ',
      sortable: true,
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <span className="font-mono text-[11px] text-[var(--text-dim)]">
          {r.createdAt.slice(0, 10)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (r) =>
        canManage && r.isCompany ? (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditing(editing === r.id ? null : r.id)}
              className="rounded-md px-2 py-1 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
            >
              تصنيف
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm('احذف هذا الأصل؟')) return;
                const fd = new FormData();
                fd.set('attachmentId', r.id);
                startTransition(async () => {
                  await deleteCompanyAsset(fd);
                  router.refresh();
                });
              }}
              className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              title="حذف"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ) : null,
    },
  ];

  const renderCard = (r: AssetRow) => (
    <div className="group flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-4 transition-colors hover:border-[var(--line-strong)]">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--surface)]">
          <FileGlyph mime={r.mimeType} />
        </div>
        <button
          type="button"
          onClick={() => openAsset(r)}
          className="min-w-0 flex-1 text-start"
        >
          <p className="truncate text-[13px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
            {r.filename}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {entityLabel(r.entityType)} · {fmtSize(r.sizeBytes)}
          </p>
        </button>
      </div>
      <div className="flex items-center justify-between">
        <StatusPill tone="info" withDot={false}>
          {CATEGORY_LABEL_AR[r.category] ?? r.category}
        </StatusPill>
        <span className="font-mono text-[10px] text-[var(--text-dim)]">
          {r.createdAt.slice(0, 10)}
        </span>
      </div>
      {r.note && <p className="truncate text-[11px] text-[var(--text-muted)]">{r.note}</p>}
    </div>
  );

  const renderCompact = (r: AssetRow) => (
    <button
      type="button"
      onClick={() => openAsset(r)}
      className="flex w-full items-center gap-3 text-start text-[13px] hover:text-[var(--accent)]"
    >
      <FileGlyph mime={r.mimeType} />
      <span className="min-w-0 flex-1 truncate text-[var(--text)]">{r.filename}</span>
      <span className="hidden shrink-0 text-[11px] text-[var(--text-muted)] sm:inline">
        {entityLabel(r.entityType)}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-[var(--text-dim)]">
        {fmtSize(r.sizeBytes)}
      </span>
    </button>
  );

  return (
    <div className="space-y-5">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowUpload((v) => !v);
              setShowLink(false);
            }}
            className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} />
            رفع أصل
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLink((v) => !v);
              setShowUpload(false);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-[12px] font-semibold text-[var(--text)] hover:border-[var(--accent)]"
          >
            <Link2 size={14} />
            ربط مستند خارجي
          </button>
        </div>
      )}

      {showUpload && canManage && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-[12px] font-semibold text-[var(--text)]">
            رفع أصل للشركة
          </p>
          <FileUpload
            entityType={COMPANY_ASSET_ENTITY}
            entityId={COMPANY_ASSET_ID}
            onChange={() => router.refresh()}
          />
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            بعد الرفع، اضغط «تصنيف» على الملف لإسناد عقد / ترخيص / تأمين … إلخ.
          </p>
        </div>
      )}

      {showLink && canManage && (
        <form
          action={(fd) => {
            startTransition(async () => {
              await addExternalAsset(fd);
              setShowLink(false);
              router.refresh();
            });
          }}
          className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-[var(--text-dim)]">اسم المستند</span>
            <input
              name="filename"
              required
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)]"
              placeholder="السجل التجاري"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-[var(--text-dim)]">الرابط</span>
            <input
              name="externalUrl"
              type="url"
              required
              dir="ltr"
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)]"
              placeholder="https://drive.google.com/…"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-[var(--text-dim)]">التصنيف</span>
            <select
              name="category"
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)]"
            >
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL_AR[c] ?? c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-[var(--text-dim)]">ملاحظة (اختياري)</span>
            <input
              name="note"
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)]"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {pending ? 'يحفظ…' : 'إضافة'}
            </button>
          </div>
        </form>
      )}

      {editing && canManage && (
        <form
          action={(fd) => {
            startTransition(async () => {
              await setAssetMeta(fd);
              setEditing(null);
              router.refresh();
            });
          }}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/[0.03] p-4"
        >
          <input type="hidden" name="attachmentId" value={editing} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-[var(--text-dim)]">التصنيف</span>
            <select
              name="category"
              defaultValue={rows.find((r) => r.id === editing)?.category || 'other'}
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)]"
            >
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL_AR[c] ?? c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[11px] text-[var(--text-dim)]">ملاحظة</span>
            <input
              name="note"
              defaultValue={rows.find((r) => r.id === editing)?.note ?? ''}
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)]"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            حفظ
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="inline-flex h-9 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-[12px] text-[var(--text)]"
          >
            إلغاء
          </button>
        </form>
      )}

      <ListWorkspace<AssetRow>
        rows={rows}
        storageKey="assets"
        getId={(r) => r.id}
        searchText={(r) =>
          [r.filename, r.note, CATEGORY_LABEL_AR[r.category], entityLabel(r.entityType)]
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
            icon={<FolderOpen size={18} />}
            title="لا أصول"
            description={
              canManage
                ? 'ارفع أول مستند للشركة — عقد، ترخيص، تأمين، أو هوية بصرية.'
                : 'لا توجد ملفات مطابقة للبحث أو الفلاتر.'
            }
            action={
              canManage ? (
                <button
                  type="button"
                  onClick={() => setShowUpload(true)}
                  className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  <Plus size={14} />
                  رفع أصل
                </button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
