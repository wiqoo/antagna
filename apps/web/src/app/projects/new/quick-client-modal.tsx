'use client';

/**
 * Quick "add a client" popup for the new-project intake. Collects only the
 * essentials, calls the non-redirecting `createClientQuick` server action, and
 * hands the new row back to the form via `onCreated` so it can be selected in
 * place — no navigation, no losing the half-filled project form.
 */
import { useState, useTransition } from 'react';
import { X, Loader2, Plus, Building2 } from 'lucide-react';
import { createClientQuick } from '@/app/clients/actions';

export type QuickClient = { id: string; code: string; nameAr: string; isAgency: boolean };

const CLIENT_TYPES = [
  { v: 'brand', l: 'العلامة مباشرةً (brand)' },
  { v: 'agency', l: 'وكالة وسيطة (agency)' },
  { v: 'dealer', l: 'موزِّع (dealer)' },
  { v: 'other', l: 'أخرى' },
];

const INDUSTRIES = [
  { v: '', l: '— القطاع (اختياري) —' },
  { v: 'real_estate', l: 'عقارات' },
  { v: 'automotive', l: 'سيارات' },
  { v: 'f_and_b', l: 'مطاعم وأغذية' },
  { v: 'retail', l: 'تجزئة' },
  { v: 'beauty_fashion', l: 'موضة وجمال' },
  { v: 'tech', l: 'تقنية وستارت أب' },
  { v: 'other', l: 'أخرى' },
];

export function QuickClientModal({
  open,
  onClose,
  onCreated,
  defaultBrandUnit = 'volt_production',
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: QuickClient) => void;
  defaultBrandUnit?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [clientType, setClientType] = useState('brand');
  const [forBrandUnit, setForBrandUnit] = useState(defaultBrandUnit);
  const [industry, setIndustry] = useState('');

  if (!open) return null;

  function reset() {
    setNameAr('');
    setNameEn('');
    setClientType('brand');
    setForBrandUnit(defaultBrandUnit);
    setIndustry('');
    setError(null);
  }

  function submit() {
    if (!nameAr.trim()) {
      setError('الاسم (عربي) مطلوب');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createClientQuick({
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || null,
        clientType,
        forBrandUnit,
        industry: industry || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated(res.client);
      reset();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
              <Building2 size={15} />
            </span>
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--text)]">عميل جديد سريع</h3>
              <p className="text-[10px] text-[var(--text-dim)]">الباقي تعدّله لاحقاً من صفحة العميل</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-dim)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
            aria-label="إغلاق"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="block text-[12px] font-medium text-[var(--text)]">
              الاسم (عربي)<span className="text-[var(--accent)]"> *</span>
            </span>
            <input
              type="text"
              value={nameAr}
              autoFocus
              onChange={(e) => setNameAr(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
              placeholder="مثال: مينام"
              className="qc-input"
            />
          </label>

          <label className="block space-y-1">
            <span className="block text-[12px] font-medium text-[var(--text)]">Name (English)</span>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
              placeholder="Mynm"
              className="qc-input"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="block text-[12px] font-medium text-[var(--text)]">النوع</span>
              <select value={clientType} onChange={(e) => setClientType(e.target.value)} className="qc-input">
                {CLIENT_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="block text-[12px] font-medium text-[var(--text)]">للحساب</span>
              <select value={forBrandUnit} onChange={(e) => setForBrandUnit(e.target.value)} className="qc-input">
                <option value="volt_production">Volt — إنتاج</option>
                <option value="abu_luka">محتوى أبو لوكا</option>
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="block text-[12px] font-medium text-[var(--text)]">القطاع</span>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="qc-input">
              {INDUSTRIES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </label>

          {error && <p className="text-[12px] text-[var(--danger)]">⚠ {error}</p>}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-[var(--line)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-md px-4 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !nameAr.trim()}
            className="magnet inline-flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--accent-gradient)' }}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {pending ? 'يُنشئ…' : 'إنشاء واختيار'}
          </button>
        </div>
      </div>

      <style>{`
        .qc-input {
          width: 100%;
          min-height: 40px;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: var(--bg);
          color: var(--text);
          font-size: 13px;
        }
        .qc-input:focus { outline: none; border-color: var(--accent); }
      `}</style>
    </div>
  );
}
