'use client';

import { useState, useTransition } from 'react';
import { StatusPill } from '@antagna/ui';
import { Loader2, Check, Plus, Trash2 } from 'lucide-react';
import { setSubscriptions, type Subscription } from '../actions';

export function SubsEditor({
  subscriptions,
  canManage,
}: {
  subscriptions: Subscription[];
  canManage: boolean;
}) {
  const [rows, setRows] = useState<Subscription[]>(subscriptions);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(rows) !== JSON.stringify(subscriptions);

  const update = (i: number, patch: Partial<Subscription>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSaved(false);
  };
  const remove = (i: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  };
  const add = () => {
    setRows((prev) => [...prev, { vendor: '', plan: '', renews_at: null, cost_usd: 0 }]);
    setSaved(false);
  };

  const inputCls =
    'h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--line-strong)]';

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
              <th className="px-5 py-3 text-start">المزوّد</th>
              <th className="px-5 py-3 text-start">الخطّة</th>
              <th className="px-5 py-3 text-start">التجديد</th>
              <th className="px-5 py-3 text-start">التكلفة $/شهر</th>
              <th className="px-5 py-3 text-end"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-xs text-[var(--text-muted)]">
                  لا اشتراكات بعد.
                </td>
              </tr>
            )}
            {rows.map((s, i) => (
              <tr key={i}>
                <td className="px-5 py-2.5">
                  <input
                    value={s.vendor}
                    disabled={!canManage}
                    onChange={(e) => update(i, { vendor: e.target.value })}
                    placeholder="Vercel"
                    className={inputCls}
                  />
                </td>
                <td className="px-5 py-2.5">
                  <input
                    value={s.plan}
                    disabled={!canManage}
                    onChange={(e) => update(i, { plan: e.target.value })}
                    placeholder="Pro"
                    className={inputCls}
                  />
                </td>
                <td className="px-5 py-2.5">
                  <input
                    type="date"
                    value={s.renews_at ?? ''}
                    disabled={!canManage}
                    onChange={(e) => update(i, { renews_at: e.target.value || null })}
                    className={inputCls + ' font-mono'}
                  />
                </td>
                <td className="px-5 py-2.5">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={s.cost_usd}
                    disabled={!canManage}
                    onChange={(e) => update(i, { cost_usd: Number(e.target.value) })}
                    className={inputCls + ' text-end font-mono'}
                  />
                </td>
                <td className="px-5 py-2.5 text-end">
                  {canManage && (
                    <button
                      onClick={() => remove(i)}
                      className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--danger)]"
                      title="حذف"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] p-3">
          <button
            onClick={add}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--line)] px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Plus size={12} /> إضافة اشتراك
          </button>
          <div className="flex items-center gap-2">
            {saved && !dirty && <span className="text-xs text-[var(--success)]">تم الحفظ</span>}
            <button
              onClick={() =>
                start(async () => {
                  await setSubscriptions(rows);
                  setSaved(true);
                })
              }
              disabled={pending || !dirty}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              حفظ الاشتراكات
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-[var(--line)] px-5 py-3">
          <StatusPill tone="neutral">عرض فقط — تحتاج صلاحية settings.update للتعديل</StatusPill>
        </div>
      )}
    </div>
  );
}
