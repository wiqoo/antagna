'use client';

import { useState, useTransition } from 'react';
import { Card } from '@antagna/ui';
import { Plus, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { createRoute, seedStarterRoutes } from './actions';

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_client', 'closed', 'spam'];

interface ProfileOpt {
  id: string;
  displayName: string;
  role: string;
}

export function RouteForm({ profiles }: { profiles: ProfileOpt[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [seedPending, startSeedTransition] = useTransition();

  const [form, setForm] = useState({
    position: '50',
    matchFromContains: '',
    matchDomain: '',
    matchSubjectRegex: '',
    matchToContains: '',
    assignToProfileId: '',
    setStatus: '',
    setLabelKey: '',
    createLeadIfNew: true,
  });

  function reset() {
    setForm({
      position: '50',
      matchFromContains: '',
      matchDomain: '',
      matchSubjectRegex: '',
      matchToContains: '',
      assignToProfileId: '',
      setStatus: '',
      setLabelKey: '',
      createLeadIfNew: true,
    });
  }

  function submit() {
    startTransition(async () => {
      await createRoute({
        position: parseInt(form.position, 10) || 50,
        matchFromContains: form.matchFromContains.trim() || null,
        matchDomain: form.matchDomain.trim() || null,
        matchSubjectRegex: form.matchSubjectRegex.trim() || null,
        matchToContains: form.matchToContains.trim() || null,
        assignToProfileId: form.assignToProfileId || null,
        setStatus: form.setStatus || null,
        setLabelKey: form.setLabelKey.trim() || null,
        createLeadIfNew: form.createLeadIfNew,
        active: true,
      });
      reset();
      setOpen(false);
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
        >
          {open ? <ChevronUp size={13} /> : <Plus size={13} />}
          {open ? 'إخفاء النموذج' : 'قاعدة جديدة'}
        </button>
        <button
          type="button"
          onClick={() => startSeedTransition(() => seedStarterRoutes())}
          disabled={seedPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          {seedPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          إضافة قواعد جاهزة
        </button>
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="ترتيب">
            <input
              type="number"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="From يحتوي" hint="مثال: noreply">
            <input
              dir="ltr"
              value={form.matchFromContains}
              onChange={(e) =>
                setForm({ ...form, matchFromContains: e.target.value })
              }
              className="input"
            />
          </Field>
          <Field label="Domain (exact)" hint="مثال: stripe.com">
            <input
              dir="ltr"
              value={form.matchDomain}
              onChange={(e) => setForm({ ...form, matchDomain: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Subject regex (case-insensitive)">
            <input
              dir="ltr"
              value={form.matchSubjectRegex}
              onChange={(e) =>
                setForm({ ...form, matchSubjectRegex: e.target.value })
              }
              className="input"
            />
          </Field>
          <Field label="عيّن لـ">
            <select
              value={form.assignToProfileId}
              onChange={(e) =>
                setForm({ ...form, assignToProfileId: e.target.value })
              }
              className="input"
            >
              <option value="">— لا أحد —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} ({p.role})
                </option>
              ))}
            </select>
          </Field>
          <Field label="حدد الـ status">
            <select
              value={form.setStatus}
              onChange={(e) => setForm({ ...form, setStatus: e.target.value })}
              className="input"
            >
              <option value="">— بدون —</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="مفتاح التسمية" hint="مثال: sales | finance">
            <input
              dir="ltr"
              value={form.setLabelKey}
              onChange={(e) => setForm({ ...form, setLabelKey: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="اعمل lead لو sender جديد">
            <input
              type="checkbox"
              checked={form.createLeadIfNew}
              onChange={(e) =>
                setForm({ ...form, createLeadIfNew: e.target.checked })
              }
              className="h-4 w-4"
            />
          </Field>
          <div className="md:col-span-2">
            <button
              onClick={submit}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-[12px] font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent-gradient)' }}
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              احفظ القاعدة
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          height: 32px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--text);
          border-radius: 6px;
          padding: 0 8px;
          font-size: 12px;
          width: 100%;
        }
      `}</style>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[10px] text-[var(--text-dim)]">{hint}</span>
      )}
    </label>
  );
}
