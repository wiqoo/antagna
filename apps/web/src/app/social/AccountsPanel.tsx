'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AccountsWorkspace, type AccountRow } from './AccountsWorkspace';
import { PLATFORMS, PLATFORM_LABEL_AR, ACCESS_TYPE_LABEL_AR } from './_shared';
import { createManagedAccount } from './actions';

const ACCESS_TYPES = ['full_admin', 'editor', 'analytics_only', 'no_api'] as const;

export function AccountsPanel({ rows, canEdit }: { rows: AccountRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="magnet inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-4 text-[12px] font-semibold text-[var(--text)] hover:border-[var(--line-strong)]"
          >
            {open ? <X size={14} /> : <Plus size={14} />}
            {open ? 'إغلاق' : 'إضافة حساب مُدار'}
          </button>
        </div>
      )}

      {canEdit && open && (
        <form
          action={createManagedAccount}
          onSubmit={() => setOpen(false)}
          className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"
        >
          <p className="text-sm font-medium text-[var(--text)]">حساب مُدار جديد</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input name="ownerLabel" required placeholder="اسم المالك / العلامة (مثال: أبو لوكا)" className="sc-in" />
            <input name="handle" required placeholder="المعرّف (بدون @)" dir="ltr" className="sc-in" />
            <select name="platform" required defaultValue="instagram" className="sc-in">
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL_AR[p]}
                </option>
              ))}
            </select>
            <select name="accessType" defaultValue="no_api" className="sc-in">
              {ACCESS_TYPES.map((a) => (
                <option key={a} value={a}>
                  {ACCESS_TYPE_LABEL_AR[a]}
                </option>
              ))}
            </select>
            <input
              name="followerCount"
              type="number"
              min="0"
              placeholder="عدد المتابعين (اختياري)"
              dir="ltr"
              className="sc-in"
            />
            <input name="notes" placeholder="ملاحظات (اختياري)" className="sc-in" />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-5 text-[13px] font-semibold text-black hover:opacity-90"
            >
              <Plus size={14} /> أضف الحساب
            </button>
          </div>
          <style>{`.sc-in{height:38px;border-radius:8px;border:1px solid var(--line);background:var(--bg-elevated);color:var(--text);font-size:13px;padding:0 10px;width:100%;}.sc-in:focus{outline:none;border-color:var(--accent);}`}</style>
        </form>
      )}

      <AccountsWorkspace rows={rows} canEdit={canEdit} onAddClick={() => setOpen(true)} />
    </div>
  );
}
