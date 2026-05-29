'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card } from '@antagna/ui';
import {
  CF_ENTITY_TYPES,
  CF_FIELD_TYPES,
  ENTITY_LABEL_AR,
  FIELD_TYPE_LABEL_AR,
  TYPES_WITH_OPTIONS,
} from './constants';
import { createCustomField } from './actions';

const inputCls =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]';
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--text-dim)]';

export function CustomFieldBuilder({ defaultEntity }: { defaultEntity?: string }) {
  const [open, setOpen] = useState(false);
  const [fieldType, setFieldType] = useState<string>('text');
  const showOptions = TYPES_WITH_OPTIONS.has(fieldType);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
      >
        <Plus size={14} />
        حقل جديد
      </button>
    );
  }

  return (
    <Card className="border-[var(--accent)]/30">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">إنشاء حقل مخصّص</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-[var(--surface-hover)]"
        >
          <X size={14} />
        </button>
      </div>
      <form action={createCustomField} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>الكيان</label>
          <select name="entity_type" defaultValue={defaultEntity ?? 'project'} className={inputCls} required>
            {CF_ENTITY_TYPES.map((e) => (
              <option key={e} value={e}>
                {ENTITY_LABEL_AR[e] ?? e}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>نوع الحقل</label>
          <select
            name="field_type"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
            className={inputCls}
            required
          >
            {CF_FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABEL_AR[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>المفتاح (key)</label>
          <input
            name="key"
            placeholder="budget_code"
            pattern="[a-z][a-z0-9_]*"
            title="حروف صغيرة وأرقام و _ فقط، يبدأ بحرف"
            className={`${inputCls} font-mono`}
            required
          />
        </div>
        <div>
          <label className={labelCls}>الاسم (عربي)</label>
          <input name="label_ar" placeholder="رمز الميزانية" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>الاسم (إنجليزي)</label>
          <input name="label_en" placeholder="Budget Code" className={inputCls} />
        </div>
        <div className="flex items-end pb-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--text)]">
            <input type="checkbox" name="required" className="h-4 w-4 accent-[var(--accent)]" />
            حقل إلزامي
          </label>
        </div>
        {showOptions && (
          <div className="sm:col-span-2">
            <label className={labelCls}>الخيارات — خيار في كل سطر، بصيغة value | label</label>
            <textarea
              name="options"
              rows={4}
              placeholder={'high | عالي\nlow | منخفض'}
              className={`${inputCls.replace('h-9', 'min-h-[88px]')} py-2 font-mono`}
            />
          </div>
        )}
        <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-9 rounded-md border border-[var(--line)] px-4 text-[12px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            إلغاء
          </button>
          <button
            type="submit"
            className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} />
            إنشاء
          </button>
        </div>
      </form>
    </Card>
  );
}
