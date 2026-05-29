'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export type EquipmentOption = { id: string; code: string; label: string };

type Line = {
  key: number;
  description: string;
  qty: string;
  unitPrice: string;
  equipmentId: string;
};

let counter = 0;
const blank = (): Line => ({
  key: counter++,
  description: '',
  qty: '1',
  unitPrice: '',
  equipmentId: '',
});

function fmt(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

/**
 * Dynamic line-item rows for a purchase order. Each row posts parallel arrays
 * (item_description[], item_qty[], item_unit_price[], item_equipment[]) that the
 * createPurchaseOrder action zips back together. Computes a live total preview.
 */
export function LineItemsEditor({ equipment }: { equipment: EquipmentOption[] }) {
  const [lines, setLines] = useState<Line[]>([blank()]);

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function remove(key: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  const total = lines.reduce((acc, l) => {
    const q = Number(l.qty.replace(/[,\s]/g, '')) || 0;
    const p = Number(l.unitPrice.replace(/[,\s]/g, '')) || 0;
    return acc + q * p;
  }, 0);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
              <th className="px-2 py-2 text-start">الوصف</th>
              <th className="w-20 px-2 py-2 text-start">الكمية</th>
              <th className="w-32 px-2 py-2 text-start">سعر الوحدة</th>
              <th className="w-48 px-2 py-2 text-start">معدّة مرتبطة</th>
              <th className="w-28 px-2 py-2 text-end">الإجمالي</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {lines.map((l) => {
              const q = Number(l.qty.replace(/[,\s]/g, '')) || 0;
              const p = Number(l.unitPrice.replace(/[,\s]/g, '')) || 0;
              return (
                <tr key={l.key}>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      name="item_description"
                      value={l.description}
                      onChange={(e) => update(l.key, { description: e.target.value })}
                      placeholder="بطارية V-mount، خدمة صيانة…"
                      className="form-input"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      name="item_qty"
                      min={1}
                      step={1}
                      value={l.qty}
                      onChange={(e) => update(l.key, { qty: e.target.value })}
                      className="form-input font-mono"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      name="item_unit_price"
                      min={0}
                      step="0.01"
                      value={l.unitPrice}
                      onChange={(e) => update(l.key, { unitPrice: e.target.value })}
                      placeholder="0.00"
                      className="form-input font-mono"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      name="item_equipment"
                      value={l.equipmentId}
                      onChange={(e) => update(l.key, { equipmentId: e.target.value })}
                      className="form-input"
                    >
                      <option value="">— لا شيء —</option>
                      {equipment.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.code} · {eq.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-end font-mono text-[12px] text-[var(--text-muted)] tabular">
                    {fmt(q * p)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => remove(l.key)}
                      disabled={lines.length <= 1}
                      title="حذف البند"
                      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, blank()])}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
        >
          <Plus size={14} /> إضافة بند
        </button>
        <p className="text-[13px] text-[var(--text-muted)]">
          الإجمالي:{' '}
          <span className="font-mono font-semibold text-[var(--text)] tabular">{fmt(total)}</span>{' '}
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">SAR</span>
        </p>
      </div>
    </div>
  );
}
