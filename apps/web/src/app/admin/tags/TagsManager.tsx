'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Tag as TagIcon, Power } from 'lucide-react';
import { StatusPill } from '@antagna/ui';
import { createTag, updateTag, toggleTag, deleteTag } from './actions';

export interface TagRow {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string | null;
  color: string | null;
  category: string | null;
  scopeEntityType: string | null;
  active: boolean;
  usageCount: number;
}

const inputCls =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none';
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--text-muted)]';

const SCOPE_LABEL: Record<string, string> = {
  project: 'المشاريع',
  client: 'العملاء',
  contact: 'جهات الاتصال',
  lead: 'الفرص',
  equipment: 'المعدات',
  profile: 'الأعضاء',
  social_account: 'حسابات السوشيال',
};

const SCOPE_OPTIONS = Object.keys(SCOPE_LABEL);

function dot(color: string | null) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border border-[var(--line)]"
      style={{ backgroundColor: color || 'var(--surface-hover)' }}
    />
  );
}

export function TagsManager({ tags }: { tags: TagRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const categories = useMemo(
    () =>
      Array.from(new Set(tags.map((t) => t.category).filter((c): c is string => !!c))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [tags],
  );

  // Group tags by category for display.
  const grouped = useMemo(() => {
    const map = new Map<string, TagRow[]>();
    for (const t of tags) {
      const cat = t.category || 'بدون فئة';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tags]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--text-muted)]">
          {tags.length} وسم · {tags.reduce((s, t) => s + t.usageCount, 0)} استخدام
        </p>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} /> وسم جديد
          </button>
        )}
      </div>

      {creating && (
        <TagForm
          categories={categories}
          mode="create"
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}

      {tags.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-10 text-center">
          <TagIcon size={22} className="mx-auto text-[var(--text-dim)]" />
          <p className="mt-3 text-[13px] font-medium text-[var(--text)]">لا وسوم بعد</p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            أنشئ وسوماً لتصنيف المشاريع والعملاء والمعدات (عاجل، VIP، سري…).
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([cat, list]) => (
            <div key={cat}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
                {cat}
              </p>
              <ul className="space-y-2">
                {list.map((t) =>
                  editingId === t.id ? (
                    <li key={t.id}>
                      <TagForm
                        categories={categories}
                        mode="edit"
                        tag={t}
                        onDone={() => setEditingId(null)}
                        onCancel={() => setEditingId(null)}
                      />
                    </li>
                  ) : (
                    <li
                      key={t.id}
                      className={
                        'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ' +
                        (t.active
                          ? 'border-[var(--line)] bg-[var(--surface)]'
                          : 'border-dashed border-[var(--line)] bg-[var(--surface)] opacity-60')
                      }
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {dot(t.color)}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-[var(--text)]">
                              {t.nameAr}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--text-dim)]">
                              {t.key}
                            </span>
                            {t.scopeEntityType && (
                              <StatusPill tone="neutral" withDot={false}>
                                {SCOPE_LABEL[t.scopeEntityType] ?? t.scopeEntityType}
                              </StatusPill>
                            )}
                          </div>
                          {t.nameEn && (
                            <p className="truncate text-[11px] text-[var(--text-muted)]" dir="ltr">
                              {t.nameEn}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusPill tone={t.usageCount > 0 ? 'success' : 'neutral'} withDot={false}>
                          {t.usageCount} استخدام
                        </StatusPill>
                        <form action={toggleTag}>
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            title={t.active ? 'تعطيل' : 'تفعيل'}
                            className={
                              'grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] ' +
                              (t.active
                                ? 'text-[var(--accent)] hover:border-[var(--accent)]'
                                : 'text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]')
                            }
                          >
                            <Power size={13} />
                          </button>
                        </form>
                        <button
                          type="button"
                          title="تعديل"
                          onClick={() => {
                            setEditingId(t.id);
                            setCreating(false);
                          }}
                          className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                          <Pencil size={13} />
                        </button>
                        <form
                          action={deleteTag}
                          onSubmit={(e) => {
                            const msg =
                              t.usageCount > 0
                                ? `حذف وسم "${t.nameAr}"؟ سيُزال من ${t.usageCount} عنصر.`
                                : `حذف وسم "${t.nameAr}"؟`;
                            if (!confirm(msg)) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            title="حذف"
                            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                          >
                            <Trash2 size={13} />
                          </button>
                        </form>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagForm({
  categories,
  mode,
  tag,
  onDone,
  onCancel,
}: {
  categories: string[];
  mode: 'create' | 'edit';
  tag?: TagRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const action = mode === 'create' ? createTag : updateTag;
  return (
    <form
      action={async (fd) => {
        await action(fd);
        onDone();
      }}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      {mode === 'edit' && tag && <input type="hidden" name="id" value={tag.id} />}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[var(--text)]">
          {mode === 'create' ? 'وسم جديد' : `تعديل ${tag?.nameAr}`}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {mode === 'create' ? (
          <div>
            <label className={labelCls}>المفتاح (key)</label>
            <input
              name="key"
              required
              placeholder="urgent"
              className={inputCls + ' font-mono'}
              dir="ltr"
            />
          </div>
        ) : (
          <div>
            <label className={labelCls}>المفتاح (key)</label>
            <input
              value={tag?.key ?? ''}
              disabled
              className={inputCls + ' font-mono opacity-60'}
              dir="ltr"
            />
          </div>
        )}
        <div>
          <label className={labelCls}>اللون</label>
          <input
            name="color"
            type="color"
            defaultValue={tag?.color ?? '#6366f1'}
            className="h-9 w-full cursor-pointer rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-1"
          />
        </div>
        <div>
          <label className={labelCls}>الاسم (عربي)</label>
          <input name="nameAr" required defaultValue={tag?.nameAr ?? ''} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>الاسم (إنجليزي)</label>
          <input name="nameEn" defaultValue={tag?.nameEn ?? ''} className={inputCls} dir="ltr" />
        </div>
        <div>
          <label className={labelCls}>الفئة</label>
          <input
            name="category"
            list="tag-categories"
            placeholder="priority / status / client…"
            defaultValue={tag?.category ?? ''}
            className={inputCls}
            dir="ltr"
          />
          <datalist id="tag-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelCls}>نطاق الكيان (اختياري)</label>
          <select
            name="scopeEntityType"
            defaultValue={tag?.scopeEntityType ?? ''}
            className={inputCls}
          >
            <option value="">— كل الكيانات —</option>
            {SCOPE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-md border border-[var(--line)] px-4 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          إلغاء
        </button>
        <button
          type="submit"
          className="h-9 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          حفظ
        </button>
      </div>
    </form>
  );
}
