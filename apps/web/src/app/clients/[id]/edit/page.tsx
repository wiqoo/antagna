import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, clients } from '@antagna/db';
import { PageHeader, Card, Button } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Save } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission, can } from '@/lib/authz';
import { updateClient } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/clients/${id}/edit`);

  // Page guard: editing is gated on client.update.
  await requirePermission('client.update');

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!client) notFound();

  // Legal/financial fields are masked unless the viewer can read financials.
  const canReadFinancial = await can('clients.read.financial');

  // Industry now uses the same dropdown + 'other' free-text pattern as
  // clients/new (keep these option values in sync with that page + the
  // createClient/updateClient industryOther handling). A stored value that
  // isn't one of the known options is treated as a custom industry: we select
  // 'other' and seed the free-text box with it, so editing a categorized
  // client no longer downgrades it to free text and a custom value survives.
  const INDUSTRY_OPTIONS = [
    'real_estate',
    'automotive',
    'f_and_b',
    'retail',
    'beauty_fashion',
    'tech',
  ] as const;
  const storedIndustry = client.industry ?? '';
  const industryIsKnown = (INDUSTRY_OPTIONS as readonly string[]).includes(
    storedIndustry,
  );
  const industrySelectValue = storedIndustry
    ? industryIsKnown
      ? storedIndustry
      : 'other'
    : '';
  const industryOtherValue = industryIsKnown ? '' : storedIndustry;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/crm">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href={`/clients/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          {client.code} · {client.nameAr}
        </Link>

        <PageHeader
          eyebrow="تعديل"
          title="تعديل العميل"
          subtitle="عدّل أي حقل ثم احفظ."
        />

        <Card>
          <form action={updateClient.bind(null, id)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="الاسم (عربي)" required>
                <input
                  type="text"
                  name="nameAr"
                  required
                  defaultValue={client.nameAr}
                  className="form-input"
                />
              </Field>
              <Field label="Name (English)">
                <input
                  type="text"
                  name="nameEn"
                  defaultValue={client.nameEn ?? ''}
                  className="form-input"
                />
              </Field>
            </div>

            <Field label="الاسم القانوني">
              <input
                type="text"
                name="legalName"
                defaultValue={canReadFinancial ? (client.legalName ?? '') : ''}
                className="form-input"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="النوع">
                <select
                  name="clientType"
                  defaultValue={client.clientType}
                  className="form-input"
                >
                  <option value="brand">brand</option>
                  <option value="dealer">dealer</option>
                  <option value="agency">agency</option>
                  <option value="other">other</option>
                </select>
              </Field>
              <Field label="القطاع">
                <select
                  name="industry"
                  defaultValue={industrySelectValue}
                  className="form-input"
                >
                  <option value="">— اختر القطاع —</option>
                  <option value="real_estate">عقارات</option>
                  <option value="automotive">سيارات</option>
                  <option value="f_and_b">مطاعم وأغذية</option>
                  <option value="retail">تجزئة</option>
                  <option value="beauty_fashion">موضة وجمال</option>
                  <option value="tech">تقنية وستارت أب</option>
                  <option value="other">أخرى…</option>
                </select>
                <input
                  type="text"
                  name="industryOther"
                  defaultValue={industryOtherValue}
                  placeholder="اكتب القطاع لو اخترت أخرى"
                  className="form-input mt-2"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="الدولة">
                <input
                  type="text"
                  name="country"
                  defaultValue={client.country}
                  className="form-input font-mono uppercase"
                />
              </Field>
              <Field label="المدينة">
                <input
                  type="text"
                  name="city"
                  defaultValue={client.city ?? ''}
                  className="form-input"
                />
              </Field>
              <Field label="الموقع">
                <input
                  type="url"
                  name="websiteUrl"
                  defaultValue={client.websiteUrl ?? ''}
                  className="form-input font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="VAT">
                <input
                  type="text"
                  name="vatNumber"
                  defaultValue={canReadFinancial ? (client.vatNumber ?? '') : ''}
                  className="form-input font-mono"
                />
              </Field>
              <Field label="CR">
                <input
                  type="text"
                  name="crNumber"
                  defaultValue={canReadFinancial ? (client.crNumber ?? '') : ''}
                  className="form-input font-mono"
                />
              </Field>
            </div>

            <Field label="ملاحظات">
              <textarea
                name="notes"
                rows={4}
                defaultValue={client.notes ?? ''}
                className="form-input"
              />
            </Field>

            <div className="flex items-center gap-3 border-t border-[var(--line)] pt-6">
              <Button variant="primary" size="lg" icon={<Save size={16} />}>
                حفظ
              </Button>
              <Link
                href={`/clients/${id}`}
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
