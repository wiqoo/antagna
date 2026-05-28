'use client';

import { useState } from 'react';
import { Card } from '@antagna/ui';
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  identifyEquipmentPhoto,
  type IdentifySuggestion,
} from '../actions';

export function IdentifyFromPhoto() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<IdentifySuggestion | null>(null);
  const [applied, setApplied] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    setSuggestion(null);
    setApplied(false);
    const fd = new FormData();
    fd.append('photo', f);
    try {
      const r = await identifyEquipmentPhoto(fd);
      if (r.ok && r.suggestion) setSuggestion(r.suggestion);
      else setError(r.error ?? 'تعذّر التعرّف.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقَّع.');
    } finally {
      setBusy(false);
    }
  }

  function applyToForm() {
    if (!suggestion) return;
    const form = document.querySelector<HTMLFormElement>('form');
    if (!form) return;
    const setField = (name: string, value: string) => {
      const el = form.querySelector<HTMLInputElement | HTMLSelectElement>(
        `[name="${name}"]`,
      );
      if (el && value) el.value = value;
    };
    setField('manufacturer', suggestion.brand);
    setField('model', suggestion.model);
    setField('category', suggestion.category);
    setApplied(true);
  }

  return (
    <Card>
      <h3 className="mb-1.5 inline-flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
        <Sparkles size={14} className="text-[var(--accent)]" />
        تعرَّف بالصورة (AI)
      </h3>
      <p className="mb-3 text-[12px] text-[var(--text-muted)]">
        ارفع صورة للمعدّة — نموذج الرؤية يقترح العلامة والموديل والفئة. لا
        يُحفظ شيء إلا بعد مراجعتك وتطبيقك.
      </p>
      <label
        className={
          'inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-4 text-[12px] text-[var(--text)] hover:border-[var(--accent)] ' +
          (busy ? 'pointer-events-none opacity-60' : '')
        }
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onChange}
          disabled={busy}
        />
        {busy ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            جاري التحليل…
          </>
        ) : (
          <>اختر صورة</>
        )}
      </label>

      {error && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-[12px] text-[var(--danger)]">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {suggestion && (
        <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-[12px]">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-[var(--text)]">اقتراح</span>
            <span className="font-mono text-[11px] text-[var(--text-dim)]">
              ثقة {suggestion.confidencePct}٪
            </span>
          </div>
          <ul className="space-y-0.5 text-[var(--text-muted)]">
            <li>
              العلامة:{' '}
              <span className="text-[var(--text)]">{suggestion.brand || '—'}</span>
            </li>
            <li>
              الموديل:{' '}
              <span className="text-[var(--text)]">{suggestion.model || '—'}</span>
            </li>
            <li>
              الفئة:{' '}
              <span className="font-mono text-[var(--text)]">{suggestion.category}</span>
            </li>
            {suggestion.notes && (
              <li className="text-[var(--text-dim)]">{suggestion.notes}</li>
            )}
          </ul>
          <button
            type="button"
            onClick={applyToForm}
            disabled={applied}
            className="mt-3 inline-flex h-8 items-center gap-1 rounded-md bg-[var(--accent)] px-3 text-[11px] font-semibold text-black hover:opacity-90 disabled:opacity-60"
          >
            <CheckCircle2 size={12} />
            {applied ? 'مُطبَّق' : 'تطبيق على النموذج'}
          </button>
        </div>
      )}
    </Card>
  );
}
