'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { parseBrief, type ParsedBrief } from './actions';

export function BriefParseForm({
  clients,
  commitAction,
}: {
  clients: Array<{ id: string; code: string; nameAr: string }>;
  commitAction: (formData: FormData) => void | Promise<void>;
}) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedBrief | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleParse() {
    if (!text.trim()) return;
    setParseError(null);
    startTransition(async () => {
      const res = await parseBrief(text);
      if (res.ok) {
        setParsed(res.parsed);
      } else {
        setParseError(res.error);
        setParsed(null);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Step 1: Paste */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
          — ١. ألصق نص البرِيف
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="ألصق هنا البريد / الـ WhatsApp / النص الذي وصلك من العميل…
الذكاء الاصطناعي هيقرأه ويستخرج التفاصيل تلقائياً."
          className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-4 text-[14px] leading-relaxed text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[var(--text-dim)]">
            {text.length} حرف
          </p>
          <button
            type="button"
            onClick={handleParse}
            disabled={isPending || !text.trim()}
            className="magnet inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}
            {isPending ? 'يحلّل…' : 'حلّل بالذكاء الاصطناعي'}
          </button>
        </div>
        {parseError && (
          <p className="text-[12px] text-[var(--danger)]">
            ⚠ فشل التحليل: {parseError}
          </p>
        )}
      </div>

      {/* Step 2: Review parsed fields */}
      {parsed && (
        <form
          action={commitAction}
          className="space-y-6 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent)]/[0.03] p-6"
        >
          <input type="hidden" name="sourceText" value={text} />
          <input type="hidden" name="parsedSummary" value={parsed.summary} />
          <input
            type="hidden"
            name="completeness"
            value={parsed.completeness_score}
          />
          <input
            type="hidden"
            name="missingFields"
            value={parsed.missing_fields.join(',')}
          />
          <input
            type="hidden"
            name="parsedLanguages"
            value={parsed.languages.join(',')}
          />
          <input
            type="hidden"
            name="parsedLocations"
            value={parsed.locations.join(',')}
          />
          <input
            type="hidden"
            name="deliverablesCount"
            value={parsed.deliverables_count ?? ''}
          />

          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              — ٢. راجع التفاصيل
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              اكتمال البرِيف:{' '}
              <span className="font-semibold text-[var(--text)]">
                {parsed.completeness_score}%
              </span>
            </p>
          </div>

          {parsed.summary && (
            <div className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-4 text-[13px] leading-relaxed text-[var(--text)]">
              {parsed.summary}
            </div>
          )}

          <Field label="العميل" required>
            <select
              name="clientId"
              required
              defaultValue=""
              className="form-input"
            >
              <option value="" disabled>
                — اختر —
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.nameAr}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="العنوان (عربي)">
              <input
                type="text"
                name="titleAr"
                defaultValue={parsed.title_ar}
                className="form-input"
              />
            </Field>
            <Field label="Title (English)" required>
              <input
                type="text"
                name="title"
                required
                defaultValue={parsed.title}
                className="form-input"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="النوع">
              <select
                name="projectType"
                defaultValue={parsed.project_type}
                className="form-input"
              >
                <option value="shoot">shoot</option>
                <option value="edit_only">edit_only</option>
                <option value="live_coverage">live_coverage</option>
                <option value="content_creation">content_creation</option>
                <option value="consulting">consulting</option>
                <option value="other">other</option>
              </select>
            </Field>
            <Field label="الميزانية (ر.س)">
              <input
                type="number"
                name="budgetSar"
                defaultValue={parsed.budget_sar ?? ''}
                step="0.01"
                className="form-input font-mono"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="موعد التصوير">
              <input
                type="date"
                name="shootStartsAt"
                defaultValue={parsed.shoot_date_iso ?? ''}
                className="form-input font-mono"
              />
            </Field>
            <Field label="موعد التسليم">
              <input
                type="date"
                name="deliveryDueAt"
                defaultValue={parsed.delivery_due_iso ?? ''}
                className="form-input font-mono"
              />
            </Field>
          </div>

          {(parsed.languages.length > 0 ||
            parsed.locations.length > 0 ||
            parsed.vehicles.length > 0) && (
            <div className="grid grid-cols-1 gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-4 md:grid-cols-3">
              {parsed.languages.length > 0 && (
                <Pillset label="اللغات" items={parsed.languages} />
              )}
              {parsed.locations.length > 0 && (
                <Pillset label="المواقع" items={parsed.locations} />
              )}
              {parsed.vehicles.length > 0 && (
                <Pillset label="السيارات" items={parsed.vehicles} />
              )}
            </div>
          )}

          {parsed.missing_fields.length > 0 && (
            <div className="rounded-md border border-[var(--warning)]/30 bg-[var(--warning)]/[0.05] p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--warning)]">
                — حقول ناقصة
              </p>
              <ul className="space-y-1 text-[12px] text-[var(--text)]">
                {parsed.missing_fields.map((f, i) => (
                  <li key={i}>· {f}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-[var(--line)] pt-5">
            <button
              type="submit"
              className="magnet inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Sparkles size={15} />
              إنشاء المشروع
            </button>
            <button
              type="button"
              onClick={() => setParsed(null)}
              className="inline-flex h-10 items-center rounded-md px-4 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface)]/60 hover:text-[var(--text)]"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      <style>{`
        .form-input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 6px;
          border: 1px solid var(--line);
          background: var(--bg-elevated);
          color: var(--text);
          font-size: 14px;
        }
        .form-input:focus { outline: none; border-color: var(--accent); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[12px] font-medium text-[var(--text)]">
        {label}
        {required && <span className="text-[var(--accent)]"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Pillset({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span
            key={i}
            className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text)]"
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
