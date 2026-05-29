'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { DealsWorkspace, type DealRow } from './DealsWorkspace';
import { DEAL_TYPE_LABEL_AR, PLATFORM_LABEL_AR } from './_shared';
import { createSponsoredDeal } from './actions';

const DEAL_TYPES = ['paid_post', 'barter', 'affiliate', 'long_term_ambassador'] as const;

export interface DealAccountOption {
  id: string;
  ownerLabel: string;
  platform: string;
  handle: string;
}

export function DealsPanel({
  rows,
  accounts,
  canEdit,
}: {
  rows: DealRow[];
  accounts: DealAccountOption[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      {canEdit && accounts.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="magnet inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-4 text-[12px] font-semibold text-[var(--text)] hover:border-[var(--line-strong)]"
          >
            {open ? <X size={14} /> : <Plus size={14} />}
            {open ? 'إغلاق' : 'صفقة رعاية جديدة'}
          </button>
        </div>
      )}

      {canEdit && open && accounts.length > 0 && (
        <form
          action={createSponsoredDeal}
          onSubmit={() => setOpen(false)}
          className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"
        >
          <p className="text-sm font-medium text-[var(--text)]">صفقة رعاية جديدة</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select name="accountId" required className="sc-in">
              <option value="">— الحساب —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ownerLabel} · {PLATFORM_LABEL_AR[a.platform] ?? a.platform} @{a.handle}
                </option>
              ))}
            </select>
            <select name="dealType" defaultValue="paid_post" className="sc-in">
              {DEAL_TYPES.map((d) => (
                <option key={d} value={d}>
                  {DEAL_TYPE_LABEL_AR[d]}
                </option>
              ))}
            </select>
            <input name="contractValueSar" type="number" step="any" min="0" placeholder="القيمة (ر.س)" dir="ltr" className="sc-in" />
            <input name="deliverablesCount" type="number" min="0" placeholder="عدد التسليمات" dir="ltr" className="sc-in" />
            <input name="startsAt" type="date" dir="ltr" className="sc-in" />
            <input name="endsAt" type="date" dir="ltr" className="sc-in" />
          </div>
          <input name="usageRightsText" placeholder="حقوق الاستخدام (اختياري)" className="sc-in w-full" />
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-5 text-[13px] font-semibold text-black hover:opacity-90"
            >
              <Plus size={14} /> سجّل الصفقة
            </button>
          </div>
          <style>{`.sc-in{height:38px;border-radius:8px;border:1px solid var(--line);background:var(--bg-elevated);color:var(--text);font-size:13px;padding:0 10px;width:100%;}.sc-in:focus{outline:none;border-color:var(--accent);}`}</style>
        </form>
      )}

      <DealsWorkspace rows={rows} canEdit={canEdit} />
    </div>
  );
}
