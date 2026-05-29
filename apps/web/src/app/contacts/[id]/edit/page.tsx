import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, contacts, contactMethods, clients } from '@antagna/db';
import { PageHeader, Card, Button } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Save } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { updateContact } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/contacts/${id}/edit`);

  // Page guard: editing is gated on contact.update.
  await requirePermission('contact.update');

  const [contact] = await db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      fullNameAr: contacts.fullNameAr,
      jobTitle: contacts.jobTitle,
      department: contacts.department,
      isPrimary: contacts.isPrimary,
      isDecisionMaker: contacts.isDecisionMaker,
      notes: contacts.notes,
      clientId: contacts.clientId,
      clientNameAr: clients.nameAr,
      clientCode: clients.code,
    })
    .from(contacts)
    .innerJoin(clients, eq(clients.id, contacts.clientId))
    .where(eq(contacts.id, id))
    .limit(1);

  if (!contact) notFound();

  const methods = await db
    .select({ type: contactMethods.methodType, value: contactMethods.value })
    .from(contactMethods)
    .where(eq(contactMethods.contactId, id));

  const firstOf = (t: string) => methods.find((m) => m.type === t)?.value ?? '';
  const email = firstOf('email');
  const phone = firstOf('phone');
  const whatsapp = firstOf('whatsapp');

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/crm">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href={`/contacts/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          {contact.fullName}
        </Link>

        <PageHeader
          eyebrow="تعديل"
          title="تعديل جهة الاتصال"
          subtitle={`تتبع: ${contact.clientNameAr ?? contact.clientCode}`}
        />

        <Card>
          <form action={updateContact.bind(null, id)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="الاسم الكامل" required>
                <input
                  type="text"
                  name="fullName"
                  required
                  defaultValue={contact.fullName}
                  className="form-input"
                />
              </Field>
              <Field label="الاسم (عربي)">
                <input
                  type="text"
                  name="fullNameAr"
                  defaultValue={contact.fullNameAr ?? ''}
                  className="form-input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="المنصب">
                <input
                  type="text"
                  name="jobTitle"
                  defaultValue={contact.jobTitle ?? ''}
                  className="form-input"
                />
              </Field>
              <Field label="القسم">
                <input
                  type="text"
                  name="department"
                  defaultValue={contact.department ?? ''}
                  className="form-input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="البريد">
                <input
                  type="email"
                  name="email"
                  defaultValue={email}
                  className="form-input font-mono"
                  dir="ltr"
                />
              </Field>
              <Field label="الهاتف">
                <input
                  type="tel"
                  name="phone"
                  defaultValue={phone}
                  className="form-input font-mono"
                  dir="ltr"
                />
              </Field>
              <Field label="واتساب">
                <input
                  type="tel"
                  name="whatsapp"
                  defaultValue={whatsapp}
                  className="form-input font-mono"
                  dir="ltr"
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-6 rounded-lg border border-[var(--line)] bg-[var(--surface)]/40 px-4 py-3">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  name="isPrimary"
                  defaultChecked={contact.isPrimary}
                  className="h-4 w-4"
                />
                جهة اتصال أساسية
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  name="isDecisionMaker"
                  defaultChecked={contact.isDecisionMaker}
                  className="h-4 w-4"
                />
                صاحب قرار
              </label>
            </div>

            <Field label="ملاحظات">
              <textarea
                name="notes"
                rows={4}
                defaultValue={contact.notes ?? ''}
                className="form-input"
              />
            </Field>

            <div className="flex items-center gap-3 border-t border-[var(--line)] pt-6">
              <Button variant="primary" size="lg" icon={<Save size={16} />}>
                حفظ
              </Button>
              <Link
                href={`/contacts/${id}`}
                className="inline-flex h-10 items-center rounded-md px-4 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)]/60 hover:text-[var(--text)]"
              >
                إلغاء
              </Link>
            </div>
          </form>
        </Card>
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
        textarea.form-input { resize: vertical; min-height: 80px; }
      `}</style>
    </Shell>
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
      <span className="block text-sm font-medium text-[var(--text)]">
        {label}
        {required && <span className="text-[var(--accent)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
