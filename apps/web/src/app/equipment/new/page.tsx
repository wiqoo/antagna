import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db, equipmentGroups } from '@antagna/db';
import { PageHeader, Card, Button } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Save } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createEquipment } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewEquipmentPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/equipment/new');

  const groups = await db
    .select({ id: equipmentGroups.id, code: equipmentGroups.code, nameAr: equipmentGroups.nameAr })
    .from(equipmentGroups)
    .orderBy(asc(equipmentGroups.nameAr));

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/equipment">
      <div className="mx-auto max-w-2xl space-y-8">
        <Link
          href="/equipment"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          المعدات
        </Link>

        <PageHeader
          eyebrow="معدّة جديدة"
          title="إضافة معدّة"
          subtitle="حدد الـ code والموديل والفئة. القيم المالية اختيارية."
        />

        <Card>
          <form action={createEquipment} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[140px,1fr]">
              <Field label="Code" required>
                <input
                  type="text"
                  name="code"
                  required
                  placeholder="A7S3-01"
                  className="form-input font-mono uppercase"
                />
              </Field>
              <Field label="الفئة" required>
                <input
                  type="text"
                  name="category"
                  required
                  placeholder="camera, lens, audio, lighting…"
                  className="form-input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="الشركة المصنعة">
                <input
                  type="text"
                  name="manufacturer"
                  placeholder="Sony, Canon, Sennheiser…"
                  className="form-input"
                />
              </Field>
              <Field label="الموديل" required>
                <input
                  type="text"
                  name="model"
                  required
                  placeholder="A7S III"
                  className="form-input"
                />
              </Field>
            </div>

            <Field label="المجموعة">
              <select name="groupId" defaultValue="" className="form-input">
                <option value="">— بدون مجموعة —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} · {g.nameAr}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Serial number">
                <input
                  type="text"
                  name="serialNumber"
                  className="form-input font-mono"
                />
              </Field>
              <Field label="الموقع الحالي">
                <input
                  type="text"
                  name="currentLocation"
                  defaultValue="warehouse"
                  className="form-input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="سعر الشراء (ر.س)">
                <input
                  type="number"
                  step="0.01"
                  name="purchasePriceSar"
                  className="form-input font-mono"
                />
              </Field>
              <Field label="قيمة التأمين (ر.س)">
                <input
                  type="number"
                  step="0.01"
                  name="insuranceValueSar"
                  className="form-input font-mono"
                />
              </Field>
            </div>

            <Field label="تاريخ الشراء">
              <input
                type="date"
                name="purchaseDate"
                className="form-input font-mono"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requiresCharging"
                className="accent-[var(--accent)]"
              />
              <span>تحتاج شحن (battery alerts)</span>
            </label>

            <div className="flex items-center gap-3 border-t border-[var(--line)] pt-6">
              <Button variant="primary" size="lg" icon={<Save size={16} />}>
                إضافة
              </Button>
              <Link
                href="/equipment"
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
