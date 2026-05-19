import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell, PageHeader, Card, Button } from '@antagna/ui';
import { ArrowLeft, Save } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewClientPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/clients/new');

  return (
    <AppShell user={{ email: user.email ?? '' }} activePath="/crm">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/crm"
          className="inline-flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-[--accent]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          العملاء
        </Link>

        <PageHeader
          eyebrow="عميل جديد"
          title="إضافة عميل"
          subtitle="حدد الـ code والاسم — البقية اختياري ويمكن تعديله لاحقاً."
        />

        <Card>
          <form action={createClient} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[140px,1fr]">
              <Field label="Code" required>
                <input
                  type="text"
                  name="code"
                  required
                  placeholder="MYNM"
                  pattern="[A-Z0-9_-]{2,16}"
                  title="حروف كبيرة وأرقام فقط، 2–16 حرف"
                  className="form-input font-mono uppercase"
                />
              </Field>
              <Field label="الاسم (عربي)" required>
                <input
                  type="text"
                  name="nameAr"
                  required
                  placeholder="مينام"
                  className="form-input"
                />
              </Field>
            </div>

            <Field label="Name (English)">
              <input
                type="text"
                name="nameEn"
                placeholder="Mynm"
                className="form-input"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="النوع">
                <select
                  name="clientType"
                  defaultValue="brand"
                  className="form-input"
                >
                  <option value="brand">brand — علامة تجارية</option>
                  <option value="dealer">dealer — موزع</option>
                  <option value="agency">agency — وكالة</option>
                  <option value="other">other — آخر</option>
                </select>
              </Field>
              <Field label="القطاع">
                <input
                  type="text"
                  name="industry"
                  placeholder="real estate, automotive…"
                  className="form-input"
                />
              </Field>
            </div>

            <Field label="الاسم القانوني">
              <input
                type="text"
                name="legalName"
                placeholder="شركة مينام للتجارة"
                className="form-input"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="الدولة">
                <input
                  type="text"
                  name="country"
                  defaultValue="SA"
                  className="form-input font-mono uppercase"
                />
              </Field>
              <Field label="المدينة">
                <input
                  type="text"
                  name="city"
                  placeholder="الرياض"
                  className="form-input"
                />
              </Field>
              <Field label="الموقع">
                <input
                  type="url"
                  name="websiteUrl"
                  placeholder="https://…"
                  className="form-input font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="VAT number">
                <input
                  type="text"
                  name="vatNumber"
                  placeholder="3xxxxxxxxxx"
                  className="form-input font-mono"
                />
              </Field>
              <Field label="CR number">
                <input
                  type="text"
                  name="crNumber"
                  className="form-input font-mono"
                />
              </Field>
            </div>

            <div className="flex items-center gap-3 border-t border-[--line] pt-6">
              <Button variant="primary" size="lg" icon={<Save size={16} />}>
                إنشاء
              </Button>
              <Link
                href="/crm"
                className="inline-flex h-11 items-center rounded-xl px-4 text-sm text-[--text-muted] hover:bg-[--surface]/60 hover:text-[--text]"
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
          height: 40px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: var(--bg-elevated);
          color: var(--text);
          font-size: 14px;
        }
        .form-input:focus { outline: none; border-color: var(--accent); }
      `}</style>
    </AppShell>
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
      <span className="block text-sm font-medium text-[--text]">
        {label}
        {required && <span className="text-[--accent]"> *</span>}
      </span>
      {children}
    </label>
  );
}
