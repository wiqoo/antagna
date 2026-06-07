'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Mail, Check, X, Loader2, ArrowLeft } from 'lucide-react';
import { importEmailProject, dismissCandidate } from './actions';

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
  valueSar: number | null;
  deliveryDue: string | null;
  summary: string | null;
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
  const [title, setTitle] = useState(c.title);
  const [clientName, setClientName] = useState(c.clientName);
  const [contactName, setContactName] = useState(c.contactName);
  const [contactEmail, setContactEmail] = useState(c.contactEmail);
  const [stage, setStage] = useState('brief');
  const [valueSar, setValueSar] = useState(c.valueSar?.toString() ?? '');
  const [deliveryDue, setDeliveryDue] = useState(c.deliveryDue ?? '');

  const [pending, start] = useTransition();
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
        stage,
        valueSar: valueSar ? Number(valueSar) : null,
        deliveryDue: deliveryDue || null,
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

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--text-dim)]">
          <Mail size={11} /> {c.subject.slice(0, 60)} · {c.msgs} رسالة
        </span>
        {c.clientExists ? (
          <span className="rounded-full border border-[var(--success)]/30 bg-[var(--success)]/10 px-2 py-0.5 text-[10px] text-[var(--success)]">عميل موجود</span>
        ) : (
          <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-dim)]">عميل جديد</span>
        )}
      </div>

      {c.summary && <p className="mb-3 text-[11px] leading-relaxed text-[var(--text-muted)]">{c.summary}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="اسم المشروع" missing={!title.trim()}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp(!title.trim())} placeholder="اكتب اسم المشروع" />
        </Field>
        <Field label="العميل" missing={!clientName.trim()}>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inp(!clientName.trim())} placeholder="اسم العميل" />
        </Field>
        <Field label="جهة الاتصال" missing={!contactName.trim()}>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inp(!contactName.trim())} placeholder="الاسم" />
        </Field>
        <Field label="بريد جهة الاتصال" missing={!contactEmail.trim()}>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inp(!contactEmail.trim()) + ' font-mono'} dir="ltr" placeholder="email@..." />
        </Field>
        <Field label="حالة المشروع">
          <select value={stage} onChange={(e) => setStage(e.target.value)} className={inp(false)}>
            {STAGES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </Field>
        <Field label="القيمة (ر.س)" missing={!valueSar}>
          <input value={valueSar} onChange={(e) => setValueSar(e.target.value)} type="number" className={inp(!valueSar) + ' font-mono'} placeholder="0" />
        </Field>
        <Field label="موعد التسليم" missing={!deliveryDue}>
          <input value={deliveryDue} onChange={(e) => setDeliveryDue(e.target.value)} type="date" className={inp(!deliveryDue) + ' font-mono'} />
        </Field>
      </div>

      {err && <p className="mt-2 text-[12px] text-[var(--danger)]">⚠ {err}</p>}

      <div className="mt-4 flex items-center gap-2 border-t border-[var(--line)] pt-3">
        <button
          onClick={confirm}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} تأكيد وإدخال في السيستم
        </button>
        <button
          onClick={dismiss}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] px-3 text-[12px] text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50"
        >
          <X size={13} /> تجاهل
        </button>
      </div>
    </div>
  );
}
