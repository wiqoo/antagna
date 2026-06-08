'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Mail, Check, X, Loader2, ArrowLeft, Sparkles, RefreshCw,
  ListChecks, HelpCircle, ArrowRight, Users, Link2, Building2,
} from 'lucide-react';
import { importEmailProject, dismissCandidate, reanalyzeCandidate } from './actions';

/** Only http(s) URLs are safe as an href — reject javascript:/data:/etc from AI output. */
function safeHref(u: string): string | null {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:' ? p.href : null;
  } catch {
    return null;
  }
}

export type Candidate = {
  threadId: string;
  subject: string;
  msgs: number;
  title: string;
  titleAr: string | null;
  clientName: string;
  clientExists: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  deliveryDue: string | null;
  summary: string | null;
  // Deep intake intelligence
  brief: string | null;
  scopeItems: string[];
  keyDetails: Array<{ label: string; value: string }>;
  decisionMakers: Array<{ name: string; role: string | null }>;
  missingInfo: string[];
  nextStep: string | null;
  refLinks: string[];
  isAbuLuka: boolean;
  businessLineReason: string | null;
};

const STAGES = [
  { v: 'lead', l: 'فرصة' },
  { v: 'brief', l: 'برِيف' },
  { v: 'quoted', l: 'مسعَّر' },
  { v: 'approved', l: 'موافَق عليه' },
  { v: 'planning', l: 'تخطيط' },
  { v: 'shooting', l: 'تصوير' },
  { v: 'editing', l: 'مونتاج' },
];

export function IntakeCard({ c }: { c: Candidate }) {
  const router = useRouter();
  const [title, setTitle] = useState(c.title);
  const [clientName, setClientName] = useState(c.clientName);
  const [contactName, setContactName] = useState(c.contactName);
  const [contactEmail, setContactEmail] = useState(c.contactEmail);
  const [contactPhone, setContactPhone] = useState(c.contactPhone ?? '');
  const [stage, setStage] = useState('brief');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [deliveryDue, setDeliveryDue] = useState(c.deliveryDue ?? '');
  const [isAbuLuka, setIsAbuLuka] = useState(c.isAbuLuka);

  const [pending, start] = useTransition();
  const [reanalyzing, startReanalyze] = useTransition();
  const [doneId, setDoneId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  function confirm() {
    setErr(null);
    start(async () => {
      const res = await importEmailProject({
        threadId: c.threadId,
        title,
        titleAr: c.titleAr,
        clientName,
        contactName,
        contactEmail,
        contactPhone: contactPhone.trim() || null,
        stage,
        quoteNumber: quoteNumber.trim() || null,
        deliveryDue: deliveryDue || null,
        isAbuLukaContent: isAbuLuka,
      });
      if (res.ok) setDoneId(res.projectId ?? 'ok');
      else setErr(res.error ?? 'فشل الإدخال');
    });
  }
  function dismiss() {
    start(async () => {
      await dismissCandidate(c.threadId);
      setHidden(true);
    });
  }
  function reanalyze() {
    setErr(null);
    startReanalyze(async () => {
      const res = await reanalyzeCandidate(c.threadId);
      if (!res.ok) setErr(res.error ?? 'فشل التحليل');
      // Soft refresh: re-renders the server component (fresh AI panel) while
      // preserving any edits the user already typed into the form inputs.
      else router.refresh();
    });
  }

  const inp = (missing: boolean) =>
    'h-9 w-full rounded-md border bg-[var(--bg-elevated)] px-2.5 text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] ' +
    (missing ? 'border-[var(--warning)]/60' : 'border-[var(--line)]');
  const Field = ({ label, children, missing }: { label: string; children: React.ReactNode; missing?: boolean }) => (
    <label className="block space-y-1">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text)]">
        {label}
        {missing && <span className="rounded bg-[var(--warning)]/15 px-1 text-[9px] text-[var(--warning)]">ناقص</span>}
      </span>
      {children}
    </label>
  );

  if (doneId) {
    return (
      <div className="rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/[0.06] p-4">
        <p className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--text)]">
          <Check size={15} className="text-[var(--success)]" /> أُدخل المشروع: {title}
        </p>
        <Link
          href={doneId !== 'ok' ? `/projects/${doneId}` : '/projects'}
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          افتح المشروع <ArrowLeft size={12} className="rtl:rotate-180" />
        </Link>
      </div>
    );
  }

  const hasIntel =
    c.brief || c.scopeItems.length > 0 || c.keyDetails.length > 0 || c.decisionMakers.length > 0 || c.refLinks.length > 0;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--text-dim)]">
          <Mail size={11} /> {c.subject.slice(0, 60)} · {c.msgs} رسالة
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={reanalyze}
            disabled={reanalyzing || pending}
            title="إعادة تحليل أعمق بالذكاء الاصطناعي"
            className="inline-flex h-6 items-center gap-1 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] px-2 text-[10px] text-[var(--accent)] hover:bg-[var(--accent)]/[0.12] disabled:opacity-50"
          >
            {reanalyzing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} {reanalyzing ? 'يحلّل…' : 'تحليل أعمق'}
          </button>
          {c.clientExists ? (
            <span className="rounded-full border border-[var(--success)]/30 bg-[var(--success)]/10 px-2 py-0.5 text-[10px] text-[var(--success)]">عميل موجود</span>
          ) : (
            <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-dim)]">عميل جديد</span>
          )}
        </div>
      </div>

      {/* ── AI intelligence panel ── */}
      {(hasIntel || c.summary) && (
        <div className="mb-3 space-y-2.5 rounded-lg border border-[var(--accent)]/15 bg-[var(--accent)]/[0.03] p-3">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
            <Sparkles size={11} /> تحليل ذكي
          </p>
          {(c.brief || c.summary) && (
            <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">{c.brief || c.summary}</p>
          )}

          {c.scopeItems.length > 0 && (
            <div>
              <p className="mb-1 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-dim)]"><ListChecks size={11} /> نطاق العمل</p>
              <div className="flex flex-wrap gap-1.5">
                {c.scopeItems.map((s, i) => (
                  <span key={i} className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text)]">{s}</span>
                ))}
              </div>
            </div>
          )}

          {c.keyDetails.length > 0 && (
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {c.keyDetails.map((k, i) => (
                <div key={i} className="flex min-w-0 gap-1.5 text-[11px]">
                  <span className="shrink-0 text-[var(--text-dim)]">{k.label}:</span>
                  <span className="min-w-0 break-words text-[var(--text)]">{k.value}</span>
                </div>
              ))}
            </div>
          )}

          {c.decisionMakers.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-dim)]"><Users size={11} /> القرار:</span>
              <span className="text-[11px] text-[var(--text)]">
                {c.decisionMakers.map((p) => (p.role ? `${p.name} · ${p.role}` : p.name)).join('، ')}
              </span>
            </div>
          )}

          {c.refLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-dim)]"><Link2 size={11} /> روابط:</span>
              {c.refLinks.map((u, i) => {
                const href = safeHref(u);
                return href ? (
                  <a key={i} href={href} target="_blank" rel="noopener noreferrer" dir="ltr" className="max-w-[200px] truncate text-[11px] text-[var(--accent)] hover:underline">{u}</a>
                ) : (
                  <span key={i} dir="ltr" className="max-w-[200px] truncate text-[11px] text-[var(--text-dim)]">{u}</span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── What to ask the client (missing info) ── */}
      {c.missingInfo.length > 0 && (
        <div className="mb-3 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/[0.05] p-3">
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--warning)]"><HelpCircle size={11} /> نسأل العميل عن</p>
          <ul className="space-y-1">
            {c.missingInfo.map((q, i) => (
              <li key={i} className="flex gap-1.5 text-[11px] text-[var(--text-muted)]"><span className="text-[var(--warning)]">•</span> {q}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Recommended next step ── */}
      {c.nextStep && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)]/[0.06] px-2.5 py-1 text-[11px] text-[var(--accent)]">
          <ArrowRight size={12} className="rtl:rotate-180" /> الخطوة الجاية: <span className="font-medium text-[var(--text)]">{c.nextStep}</span>
        </p>
      )}

      <fieldset disabled={reanalyzing} className="contents">
      {/* ── Business-line classification (Volt client vs Abu Luka content) ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/50 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text)]">
          <Building2 size={13} className="text-[var(--text-dim)]" /> التصنيف
          {c.businessLineReason && c.isAbuLuka === isAbuLuka && (
            <span className="rounded bg-[var(--accent)]/10 px-1 text-[9px] text-[var(--accent)]">حسب التحليل</span>
          )}
        </span>
        <div className="inline-flex rounded-md border border-[var(--line)] p-0.5">
          <button
            type="button"
            onClick={() => setIsAbuLuka(false)}
            className={'h-7 rounded px-3 text-[11px] font-medium transition ' + (!isAbuLuka ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]')}
          >
            فولت · عميل
          </button>
          <button
            type="button"
            onClick={() => { setIsAbuLuka(true); if (!clientName.trim()) setClientName('أبو لوكا'); }}
            className={'h-7 rounded px-3 text-[11px] font-medium transition ' + (isAbuLuka ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]')}
          >
            محتوى أبو لوكا
          </button>
        </div>
        {c.businessLineReason && (
          <p className="w-full text-[10px] leading-relaxed text-[var(--text-dim)]">{c.businessLineReason}</p>
        )}
      </div>
      <div className={'grid grid-cols-1 gap-3 sm:grid-cols-2 ' + (reanalyzing ? 'opacity-50' : '')}>
        <Field label="اسم المشروع" missing={!title.trim()}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp(!title.trim())} placeholder="اكتب اسم المشروع" />
        </Field>
        <Field label={isAbuLuka ? 'الجهة' : 'العميل'} missing={!clientName.trim()}>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inp(!clientName.trim())} placeholder={isAbuLuka ? 'أبو لوكا' : 'اسم العميل'} />
        </Field>
        <Field label="جهة الاتصال" missing={!contactName.trim()}>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inp(!contactName.trim())} placeholder="الاسم" />
        </Field>
        <Field label="بريد جهة الاتصال" missing={!contactEmail.trim()}>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inp(!contactEmail.trim()) + ' font-mono'} dir="ltr" placeholder="email@..." />
        </Field>
        <Field label="هاتف جهة الاتصال">
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inp(false) + ' font-mono'} dir="ltr" placeholder="+9665..." />
        </Field>
        <Field label="حالة المشروع">
          <select value={stage} onChange={(e) => setStage(e.target.value)} className={inp(false)}>
            {STAGES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </Field>
        <Field label="رقم عرض السعر">
          <input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} className={inp(false) + ' font-mono'} dir="ltr" placeholder="من دفترة (اختياري)" />
        </Field>
        <Field label="موعد التسليم" missing={!deliveryDue}>
          <input value={deliveryDue} onChange={(e) => setDeliveryDue(e.target.value)} type="date" className={inp(!deliveryDue) + ' font-mono'} />
        </Field>
      </div>
      </fieldset>

      {err && <p className="mt-2 text-[12px] text-[var(--danger)]">⚠ {err}</p>}

      <div className="mt-4 flex items-center gap-2 border-t border-[var(--line)] pt-3">
        <button
          onClick={confirm}
          disabled={pending || reanalyzing}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} تأكيد وإدخال في السيستم
        </button>
        <button
          onClick={dismiss}
          disabled={pending || reanalyzing}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] px-3 text-[12px] text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50"
        >
          <X size={13} /> تجاهل
        </button>
      </div>
    </div>
  );
}
