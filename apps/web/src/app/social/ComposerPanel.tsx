'use client';

import { Plus } from 'lucide-react';
import { Card } from '@antagna/ui';
import { POST_FORMATS, FORMAT_LABEL_AR, PLATFORM_LABEL_AR } from './_shared';
import { createContentPost } from './actions';

export interface AccountOption {
  id: string;
  ownerLabel: string;
  platform: string;
  handle: string;
}

/** The content composer — manual content planning (OAuth posting off, D-028). */
export function ComposerPanel({ accounts }: { accounts: AccountOption[] }) {
  return (
    <Card>
      <p className="mb-3 text-sm font-medium text-[var(--text)]">فكرة / منشور جديد</p>
      {accounts.length === 0 ? (
        <p className="text-[12px] text-[var(--text-dim)]">
          أضف حساباً مُداراً أولاً من تبويب «الحسابات» لتتمكّن من جدولة المحتوى.
        </p>
      ) : (
        <form action={createContentPost} className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
            <select name="accountId" required className="sc-in">
              <option value="">— الحساب —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ownerLabel} · {PLATFORM_LABEL_AR[a.platform] ?? a.platform} @{a.handle}
                </option>
              ))}
            </select>
            <input name="title" required placeholder="عنوان الفكرة" className="sc-in" />
          </div>
          <input name="caption" placeholder="النص / الكابشن (اختياري)" className="sc-in w-full" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr_auto]">
            <select name="format" defaultValue="reel" className="sc-in">
              {POST_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABEL_AR[f]}
                </option>
              ))}
            </select>
            <input name="plannedPublishAt" type="datetime-local" className="sc-in" dir="ltr" />
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[13px] font-semibold text-black hover:opacity-90"
            >
              <Plus size={14} /> أضف
            </button>
          </div>
          <p className="text-[10px] text-[var(--text-dim)]">
            بتحديد موعد نشر تتحوّل الحالة تلقائياً إلى «مجدول».
          </p>
        </form>
      )}
      <style>{`.sc-in{height:36px;border-radius:8px;border:1px solid var(--line);background:var(--bg-elevated);color:var(--text);font-size:13px;padding:0 10px;}.sc-in:focus{outline:none;border-color:var(--accent);}`}</style>
    </Card>
  );
}
