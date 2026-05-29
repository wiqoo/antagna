'use client';

import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { TYPES_WITH_OPTIONS, FIELD_TYPE_LABEL_AR, optionsToText } from './constants';
import { updateCustomField } from './actions';

const inputCls =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]';
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--text-dim)]';

export function EditFieldButton({
  id,
  fieldType,
  labelAr,
  labelEn,
  required,
  options,
}: {
  id: string;
  fieldType: string;
  labelAr: string;
  labelEn: string | null;
  required: boolean;
  options: unknown;
}) {
  const [open, setOpen] = useState(false);
  const showOptions = TYPES_WITH_OPTIONS.has(fieldType);

  return (
    <>
      <button
        type="button"
        title="تعديل"
        onClick={() => setOpen(true)}
        className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <Pencil size={12} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                تعديل الحقل · {FIELD_TYPE_LABEL_AR[fieldType] ?? fieldType}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-[var(--surface-hover)]"
              >
                <X size={14} />
              </button>
            </div>
            <form action={updateCustomField} className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="field_type" value={fieldType} />
              <div>
                <label className={labelCls}>الاسم (عربي)</label>
                <input name="label_ar" defaultValue={labelAr} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>الاسم (إنجليزي)</label>
                <input name="label_en" defaultValue={labelEn ?? ''} className={inputCls} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--text)]">
                <input
                  type="checkbox"
                  name="required"
                  defaultChecked={required}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                حقل إلزامي
              </label>
              {showOptions && (
                <div>
                  <label className={labelCls}>الخيارات — خيار في كل سطر (value | label)</label>
                  <textarea
                    name="options"
                    rows={4}
                    defaultValue={optionsToText(options)}
                    className={`${inputCls.replace('h-9', 'min-h-[88px]')} py-2 font-mono`}
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 rounded-md border border-[var(--line)] px-4 text-[12px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="magnet inline-flex h-9 items-center rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
