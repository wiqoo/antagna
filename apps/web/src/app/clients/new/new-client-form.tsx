'use client';

/**
 * Practical new-client form: essentials are always visible, the rarely-filled
 * fields collapse under "تفاصيل إضافية", and an "ابحث بالـ AI" bar researches the
 * company on the web and fills industry/website/city for you. A brand can be
 * placed under an agency inline.
 */
import { useState, useTransition } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { createClient, researchClientFields } from '../actions';

type Agency = { id: string; nameAr: string | null };

const INDUSTRIES = [
  { v: '', l: '— اختر القطاع —' },
  { v: 'real_estate', l: 'عقارات' },
  { v: 'automotive', l: 'سيارات' },
  { v: 'f_and_b', l: 'مطاعم وأغذية' },
  { v: 'retail', l: 'تجزئة' },
  { v: 'beauty_fashion', l: 'موضة وجمال' },
  { v: 'tech', l: 'تقنية وستارت أب' },
  { v: 'other', l: 'أخرى…' },
];

export function NewClientForm({
  agencies,
  prefillName,
  leadId,
  lockedAgencyId,
}: {
  agencies: Agency[];
  prefillName: string;
  leadId: string;
  lockedAgencyId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  const [nameAr, setNameAr] = useState(prefillName);
  const [nameEn, setNameEn] = useState('');
  const [clientType, setClientType] = useState('brand');
  const [industry, setIndustry] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('SA');
  const [showAdvanced, setShowAdvanced] = useState(false);

  function runResearch() {
    const q = (nameEn || nameAr).trim();
    if (!q) {
      setAiStatus('اكتب اسم العميل أولاً');
      return;
    }
    setAiStatus(null);
    startTransition(async () => {
      const res = await researchClientFields(q);
      if (!res.ok || !res.fields) {
        setAiStatus(res.error ?? 'تعذّر البحث');
        return;
      }
      const f = res.fields;
      if (f.industry) setIndustry(matchIndustry(f.industry));
      if (f.websiteUrl) setWebsiteUrl(f.websiteUrl);
      if (f.city) setCity(f.city);
      if (f.country) setCountry(f.country);
      setShowAdvanced(true);
      setAiStatus(`تمّ — ${f.summaryAr ? f.summaryAr.slice(0, 90) : 'مُلئت الحقول المتاحة'}`);
    });
  }

  const showAgencyPicker = !lockedAgencyId && clientType === 'brand' && agencies.length > 0;

  return (
    <form action={createClient} className="space-y-6">
      {leadId && <input type="hidden" name="leadId" value={leadId} />}
      {lockedAgencyId && <input type="hidden" name="agencyId" value={lockedAgencyId} />}

      {/* AI research bar */}
      <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/[0.04] p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-[12px] font-medium text-[var(--text)]">
              <Sparkles size={12} className="inline text-[var(--accent)]" /> ابحث بالـ AI
            </label>
            <input
              type="text"
              value={nameEn || nameAr}
              onChange={(e) => (nameEn ? setNameEn(e.target.value) : setNameAr(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runResearch(); } }}
              placeholder="اسم الشركة أو موقعها (example.com)"
              className="form-input"
            />
          </div>
          <button
            type="button"
            onClick={runResearch}
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {pending ? 'يبحث…' : 'ابحث واملأ'}
          </button>
        </div>
        {aiStatus && <p className="mt-2 text-[11px] text-[var(--text-muted)]">{aiStatus}</p>}
      </div>

      {/* Essentials */}
      <Field label="الاسم (عربي)" required>
        <input type="text" name="nameAr" required value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مينام" className="form-input" />
      </Field>

      <Field label="Name (English)">
        <input type="text" name="nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Mynm" className="form-input" />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="للحساب" hint="Volt (إنتاج) أم محتوى أبو لوكا — يحدد التقارير ومسارات الاعتماد." required>
          <select name="forBrandUnit" defaultValue="volt_production" className="form-input">
            <option value="volt_production">Volt — إنتاج</option>
            <option value="abu_luka">محتوى أبو لوكا</option>
          </select>
        </Field>
        <Field label="نوع العميل" hint="العلامة مباشرةً أم وكالة وسيطة؟">
          <select name="clientType" value={clientType} onChange={(e) => setClientType(e.target.value)} className="form-input">
            <option value="brand">العلامة مباشرةً (brand)</option>
            <option value="agency">وكالة وسيطة (agency)</option>
            <option value="dealer">موزِّع (dealer)</option>
            <option value="other">أخرى</option>
          </select>
        </Field>
      </div>

      {showAgencyPicker && (
        <Field label="تحت وكالة (اختياري)" hint="لو هذا العميل النهائي تديره وكالة وسيطة، اختَرها هنا.">
          <select name="agencyId" defaultValue="" className="form-input">
            <option value="">— بدون وكالة (عميل مباشر) —</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>{a.nameAr ?? '—'}</option>
            ))}
          </select>
        </Field>
      )}

      {/* Advanced (collapsible) */}
      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        تفاصيل إضافية (اختياري)
      </button>

      <div className={showAdvanced ? 'space-y-4' : 'hidden'}>
        <Field label="القطاع">
          <select name="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="form-input">
            {INDUSTRIES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <input type="text" name="industryOther" placeholder="اكتب القطاع لو اخترت أخرى" className="form-input mt-2" />
        </Field>

        <Field label="الاسم القانوني">
          <input type="text" name="legalName" placeholder="شركة مينام للتجارة" className="form-input" />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="الدولة">
            <input type="text" name="country" value={country} onChange={(e) => setCountry(e.target.value)} className="form-input font-mono uppercase" />
          </Field>
          <Field label="المدينة">
            <input type="text" name="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="الرياض" className="form-input" />
          </Field>
          <Field label="الموقع">
            <input type="url" name="websiteUrl" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" className="form-input font-mono" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="الرقم الضريبي">
            <input type="text" name="vatNumber" placeholder="3xxxxxxxxxx" className="form-input font-mono" />
          </Field>
          <Field label="رقم السجل التجاري">
            <input type="text" name="crNumber" className="form-input font-mono" />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--line)] pt-6">
        <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] active:scale-[0.98]">
          <Save size={16} /> إنشاء
        </button>
        <a href="/crm" className="inline-flex h-10 items-center rounded-md px-4 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)]/60 hover:text-[var(--text)]">إلغاء</a>
      </div>

      <style>{`
        .form-input { width: 100%; min-height: 40px; padding: 8px 12px; border-radius: 10px;
          border: 1px solid var(--line); background: var(--bg-elevated); color: var(--text); font-size: 14px; }
        .form-input:focus { outline: none; border-color: var(--accent); }
      `}</style>
    </form>
  );
}

function matchIndustry(raw: string): string {
  const s = raw.toLowerCase();
  if (/real.?estate|عقار/.test(s)) return 'real_estate';
  if (/auto|car|سيار/.test(s)) return 'automotive';
  if (/food|restaurant|f&b|مطعم|أغذ/.test(s)) return 'f_and_b';
  if (/retail|تجزئة|متاجر/.test(s)) return 'retail';
  if (/beauty|fashion|موضة|جمال|تجميل/.test(s)) return 'beauty_fashion';
  if (/tech|software|startup|تقني|برمج/.test(s)) return 'tech';
  return 'other';
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-[var(--text)]">
        {label}
        {required && <span className="text-[var(--accent)]"> *</span>}
      </span>
      {hint && <span className="block text-[11px] leading-relaxed text-[var(--text-dim)]">{hint}</span>}
      {children}
    </label>
  );
}
