'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Link2, Bot, Users } from 'lucide-react';
import { StatusPill } from '@antagna/ui';
import {
  createCompatibilityRule,
  updateCompatibilityRule,
  deleteCompatibilityRule,
} from './actions';

export interface RuleRow {
  id: string;
  sideALabel: string;
  sideBLabel: string;
  verdict: string;
  reasonAr: string | null;
  reasonEn: string | null;
  source: string;
  verifiedCount: number;
}

export interface ItemOption {
  id: string;
  label: string;
}

const inputCls =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none';
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--text-muted)]';

const VERDICT_TONE: Record<string, 'success' | 'danger' | 'neutral'> = {
  compatible: 'success',
  incompatible: 'danger',
  unverified: 'neutral',
};
const VERDICT_LABEL: Record<string, string> = {
  compatible: 'متوافق',
  incompatible: 'غير متوافق',
  unverified: 'غير مؤكّد',
};
const SOURCE_LABEL: Record<string, string> = {
  manual: 'يدوي',
  promoted_from_feedback: 'من الملاحظات',
  ai_inferred: 'استنتاج AI',
};

export function CompatibilityManager({
  rules,
  items,
  groups,
  tags,
}: {
  rules: RuleRow[];
  items: ItemOption[];
  groups: ItemOption[];
  tags: ItemOption[];
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--text-muted)]">{rules.length} قاعدة توافق</p>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} /> قاعدة جديدة
          </button>
        )}
      </div>

      {creating && (
        <RuleForm
          items={items}
          groups={groups}
          tags={tags}
          mode="create"
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}

      {rules.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-10 text-center">
          <Link2 size={22} className="mx-auto text-[var(--text-dim)]" />
          <p className="mt-3 text-[13px] font-medium text-[var(--text)]">لا قواعد توافق بعد</p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            عرّف أيّ المعدات تعمل معاً (أو لا تعمل) — مثل عدسة مع كاميرا، أو ميكروفون مع مستقبِل.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) =>
            editingId === r.id ? (
              <li key={r.id}>
                <RuleForm
                  items={items}
                  groups={groups}
                  tags={tags}
                  mode="edit"
                  rule={r}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)]">
                    {r.source === 'ai_inferred' ? <Bot size={16} /> : <Link2 size={16} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text)]">
                      <span className="truncate font-medium">{r.sideALabel}</span>
                      <span className="text-[var(--text-dim)]">↔</span>
                      <span className="truncate font-medium">{r.sideBLabel}</span>
                    </div>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {SOURCE_LABEL[r.source] ?? r.source}
                      {r.verifiedCount > 1 ? ` · مؤكّد ${r.verifiedCount}×` : ''}
                      {r.reasonAr ? ` · ${r.reasonAr}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tone={VERDICT_TONE[r.verdict] ?? 'neutral'}>
                    {VERDICT_LABEL[r.verdict] ?? r.verdict}
                  </StatusPill>
                  <button
                    type="button"
                    title="تعديل"
                    onClick={() => {
                      setEditingId(r.id);
                      setCreating(false);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <Pencil size={13} />
                  </button>
                  <form
                    action={deleteCompatibilityRule}
                    onSubmit={(e) => {
                      if (!confirm('حذف قاعدة التوافق هذه؟')) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={r.id} />
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
      )}
    </div>
  );
}

/** Single grouped <select> covering items / groups / tags as one "kind:value" string. */
function SideSelect({
  name,
  items,
  groups,
  tags,
}: {
  name: string;
  items: ItemOption[];
  groups: ItemOption[];
  tags: ItemOption[];
}) {
  return (
    <select name={name} required defaultValue="" className={inputCls}>
      <option value="" disabled>
        — اختر —
      </option>
      {groups.length > 0 && (
        <optgroup label="مجموعات">
          {groups.map((g) => (
            <option key={`g-${g.id}`} value={`group:${g.id}`}>
              {g.label}
            </option>
          ))}
        </optgroup>
      )}
      {items.length > 0 && (
        <optgroup label="معدات">
          {items.map((i) => (
            <option key={`i-${i.id}`} value={`item:${i.id}`}>
              {i.label}
            </option>
          ))}
        </optgroup>
      )}
      {tags.length > 0 && (
        <optgroup label="وسوم">
          {tags.map((t) => (
            <option key={`t-${t.id}`} value={`tag:${t.id}`}>
              {t.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

function RuleForm({
  items,
  groups,
  tags,
  mode,
  rule,
  onDone,
  onCancel,
}: {
  items: ItemOption[];
  groups: ItemOption[];
  tags: ItemOption[];
  mode: 'create' | 'edit';
  rule?: RuleRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const action = mode === 'create' ? createCompatibilityRule : updateCompatibilityRule;
  return (
    <form
      action={async (fd) => {
        await action(fd);
        onDone();
      }}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      {mode === 'edit' && rule && <input type="hidden" name="id" value={rule.id} />}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[var(--text)]">
          {mode === 'create' ? 'قاعدة توافق جديدة' : 'تعديل القاعدة'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <X size={15} />
        </button>
      </div>

      {mode === 'edit' && rule ? (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--surface-hover)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
          <Users size={13} /> {rule.sideALabel} ↔ {rule.sideBLabel}
          <span className="text-[var(--text-dim)]">
            (الطرفان غير قابلين للتعديل — احذف القاعدة وأنشئ غيرها لتغييرهما)
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>الطرف الأول</label>
            <SideSelect name="sideA" items={items} groups={groups} tags={tags} />
          </div>
          <div>
            <label className={labelCls}>الطرف الثاني</label>
            <SideSelect name="sideB" items={items} groups={groups} tags={tags} />
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>الحكم</label>
          <select name="verdict" defaultValue={rule?.verdict ?? 'compatible'} className={inputCls}>
            <option value="compatible">متوافق</option>
            <option value="incompatible">غير متوافق</option>
            <option value="unverified">غير مؤكّد</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>السبب (عربي)</label>
          <input name="reasonAr" defaultValue={rule?.reasonAr ?? ''} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>السبب (إنجليزي)</label>
          <input
            name="reasonEn"
            defaultValue={rule?.reasonEn ?? ''}
            className={inputCls}
            dir="ltr"
          />
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
