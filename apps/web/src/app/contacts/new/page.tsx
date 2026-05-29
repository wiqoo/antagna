import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asc, isNull } from 'drizzle-orm';
import { db, clients } from '@antagna/db';
import { PageHeader, Card, Button, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Save, Building2 } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createContact } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; name?: string }>;
}) {
  const sp = await searchParams;
  const prefillClientId = typeof sp.clientId === 'string' ? sp.clientId : '';
  const prefillName = typeof sp.name === 'string' ? sp.name : '';

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/contacts/new');

  // A contact MUST belong to a client (contacts.client_id is NOT NULL).
  const clientList = await db
    .select({ id: clients.id, code: clients.code, nameAr: clients.nameAr, nameEn: clients.nameEn })
    .from(clients)
    .where(isNull(clients.archivedAt))
    .orderBy(asc(clients.nameAr));

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/crm">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          جهات الاتصال
        </Link>

        <PageHeader
          eyebrow="جهة اتصال جديدة"
          title="إضافة جهة اتصال"
          subtitle="اختر العميل وأدخل الاسم — البقية اختياري ويمكن تعديله لاحقاً."
        />

        {clientList.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Building2 size={18} />}
              title="لا يوجد عملاء بعد"
              description="جهة الاتصال تتبع عميلاً — أضف عميلاً أولاً ثم عُد لإضافة جهات الاتصال."
              action={
                <Link
                  href="/clients/new"
                  className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  <Building2 size={14} />
                  عميل جديد
                </Link>
              }
            />
          </Card>
        ) : (
          <Card>
            <form action={createContact} className="space-y-6">
              <Field label="العميل" required hint="جهة الاتصال تتبع عميلاً واحداً.">
                <select
                  name="clientId"
                  required
                  defaultValue={prefillClientId}
                  className="form-input"
                >
                  <option value="" disabled>
                    — اختر العميل —
                  </option>
                  {clientList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                      {c.nameEn ? ` · ${c.nameEn}` : ''} ({c.code})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="الاسم الكامل" required>
                  <input
                    type="text"
                    name="fullName"
                    required
                    defaultValue={prefillName}
                    placeholder="محمد الأحمد"
                    className="form-input"
                  />
                </Field>
                <Field label="الاسم (عربي)">
                  <input type="text" name="fullNameAr" className="form-input" />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="المنصب">
                  <input
                    type="text"
                    name="jobTitle"
                    placeholder="مدير التسويق"
                    className="form-input"
                  />
                </Field>
                <Field label="القسم">
                  <input
                    type="text"
                    name="department"
                    placeholder="التسويق"
                    className="form-input"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="البريد">
                  <input
                    type="email"
                    name="email"
                    placeholder="name@brand.com"
                    className="form-input font-mono"
                    dir="ltr"
                  />
                </Field>
                <Field label="الهاتف">
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+9665xxxxxxxx"
                    className="form-input font-mono"
                    dir="ltr"
                  />
                </Field>
                <Field label="واتساب">
                  <input
                    type="tel"
                    name="whatsapp"
                    placeholder="+9665xxxxxxxx"
                    className="form-input font-mono"
                    dir="ltr"
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-6 rounded-lg border border-[var(--line)] bg-[var(--surface)]/40 px-4 py-3">
                <label className="inline-flex items-center gap-2 text-sm text-[var(--text)]">
                  <input type="checkbox" name="isPrimary" className="h-4 w-4" />
                  جهة اتصال أساسية
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-[var(--text)]">
                  <input type="checkbox" name="isDecisionMaker" className="h-4 w-4" />
                  صاحب قرار
                </label>
              </div>

              <Field label="ملاحظات">
                <textarea name="notes" rows={3} className="form-input" />
              </Field>

              <div className="flex items-center gap-3 border-t border-[var(--line)] pt-6">
                <Button variant="primary" size="lg" icon={<Save size={16} />}>
                  إنشاء
                </Button>
                <Link
                  href="/contacts"
                  className="inline-flex h-10 items-center rounded-md px-4 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)]/60 hover:text-[var(--text)]"
                >
                  إلغاء
                </Link>
              </div>
            </form>
          </Card>
        )}
      </div>

      <style>{`
        .form-input {
          width: 100%;
          min-height: 40px;
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: var(--bg-elevated);
          color: var(--text);
          font-size: 14px;
        }
        .form-input:focus { outline: none; border-color: var(--accent); }
        textarea.form-input { resize: vertical; min-height: 70px; }
      `}</style>
    </Shell>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-[var(--text)]">
        {label}
        {required && <span className="text-[var(--accent)]"> *</span>}
      </span>
      {hint && (
        <span className="block text-[11px] leading-relaxed text-[var(--text-dim)]">{hint}</span>
      )}
      {children}
    </label>
  );
}
