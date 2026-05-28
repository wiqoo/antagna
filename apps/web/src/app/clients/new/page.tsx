import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader, Card, Button } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Save } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; leadId?: string }>;
}) {
  const sp = await searchParams;
  const prefillName = typeof sp.name === 'string' ? sp.name : '';
  const leadId = typeof sp.leadId === 'string' ? sp.leadId : '';

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/clients/new');

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/crm">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/crm"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          العملاء
        </Link>

        <PageHeader
          eyebrow="عميل جديد"
          title="إضافة عميل"
          subtitle="حدد الـ code والاسم — البقية اختياري ويمكن تعديله لاحقاً."
        />

        {leadId && (
          <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-[13px] text-[var(--text)]">
            تحويل فرصة (lead) إلى عميل — أكمل البيانات وسيُربط الـ lead بالعميل الجديد تلقائياً.
          </div>
        )}

        <Card>
          <form action={createClient} className="space-y-6">
            {leadId && <input type="hidden" name="leadId" value={leadId} />}

            {/* Code is auto-generated server-side from the English/Arabic name. */}

            <Field label="الاسم (عربي)" required>
              <input
                type="text"
                name="nameAr"
                required
                defaultValue={prefillName}
                placeholder="مينام"
                className="form-input"
              />
            </Field>

            <Field label="Name (English)">
              <input
                type="text"
                name="nameEn"
                placeholder="Mynm"
                className="form-input"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="للحساب"
                hint="Volt (إنتاج) أم محتوى أبو لوكا — يحدد التقارير ومسارات الاعتماد."
                required
              >
                <select name="forBrandUnit" defaultValue="volt_production" className="form-input">
                  <option value="volt_production">Volt — إنتاج</option>
                  <option value="abu_luka">محتوى أبو لوكا</option>
                </select>
              </Field>
              <Field
                label="نوع العميل"
                hint="هل تتعامل مع العلامة مباشرةً أم عبر وكالة وسيطة؟"
              >
                <select
                  name="clientType"
                  defaultValue="brand"
                  className="form-input"
                >
                  <option value="brand">العلامة مباشرةً (brand)</option>
                  <option value="agency">وكالة وسيطة (agency)</option>
                  <option value="dealer">موزِّع (dealer)</option>
                  <option value="other">أخرى</option>
                </select>
              </Field>
            </div>

            <Field label="القطاع">
              <select name="industry" defaultValue="" className="form-input" id="industry-select">
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
                placeholder="اكتب القطاع لو اخترت أخرى"
                className="form-input mt-2"
              />
            </Field>

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
              <Field label="الرقم الضريبي">
                <input
                  type="text"
                  name="vatNumber"
                  placeholder="3xxxxxxxxxx"
                  className="form-input font-mono"
                />
              </Field>
              <Field label="رقم السجل التجاري">
                <input
                  type="text"
                  name="crNumber"
                  className="form-input font-mono"
                />
              </Field>
            </div>

            <div className="flex items-center gap-3 border-t border-[var(--line)] pt-6">
              <Button variant="primary" size="lg" icon={<Save size={16} />}>
                إنشاء
              </Button>
              <Link
                href="/crm"
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
        <span className="block text-[11px] leading-relaxed text-[var(--text-dim)]">
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}
