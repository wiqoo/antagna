import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asc, isNull } from 'drizzle-orm';
import { db, equipment } from '@antagna/db';
import { PageHeader, Card, Button } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Save } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { createPurchaseOrder } from '../actions';
import { LineItemsEditor, type EquipmentOption } from './LineItemsEditor';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/orders/new');

  await requirePermission('procurement.manage');

  const eqRows = await db
    .select({
      id: equipment.id,
      code: equipment.code,
      manufacturer: equipment.manufacturer,
      model: equipment.model,
    })
    .from(equipment)
    .where(isNull(equipment.archivedAt))
    .orderBy(asc(equipment.code))
    .limit(500);

  const equipmentOptions: EquipmentOption[] = eqRows.map((e) => ({
    id: e.id,
    code: e.code,
    label: [e.manufacturer, e.model].filter(Boolean).join(' ') || e.model,
  }));

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/orders">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          أوامر الشراء
        </Link>

        <PageHeader
          eyebrow="أمر شراء جديد"
          title="إنشاء أمر شراء"
          subtitle="حدّد المورّد وأضف بنود الشراء. الكود يُولَّد تلقائياً إن تُرك فارغاً."
        />

        <Card>
          <form action={createPurchaseOrder} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="المورّد" required>
                <input
                  type="text"
                  name="vendorName"
                  required
                  placeholder="Sony Middle East، متجر المعدات…"
                  className="form-input"
                />
              </Field>
              <Field label="الكود">
                <input
                  type="text"
                  name="code"
                  placeholder="PO-001 (تلقائي إن فارغ)"
                  className="form-input font-mono uppercase"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="الحالة">
                <select name="status" defaultValue="draft" className="form-input">
                  <option value="draft">مسودّة</option>
                  <option value="sent">مُرسَل</option>
                  <option value="received">مُستلَم</option>
                  <option value="cancelled">ملغى</option>
                </select>
              </Field>
              <Field label="تاريخ الطلب">
                <input type="date" name="orderedAt" className="form-input font-mono" />
              </Field>
              <Field label="التسليم المتوقَّع">
                <input type="date" name="expectedAt" className="form-input font-mono" />
              </Field>
            </div>

            <Field label="العملة">
              <input
                type="text"
                name="currency"
                defaultValue="SAR"
                className="form-input font-mono uppercase max-w-[120px]"
              />
            </Field>

            <div className="space-y-2 border-t border-[var(--line)] pt-5">
              <span className="block text-sm font-medium text-[var(--text)]">البنود</span>
              <LineItemsEditor equipment={equipmentOptions} />
            </div>

            <Field label="ملاحظات">
              <textarea
                name="notes"
                rows={3}
                placeholder="شروط الدفع، مرجع عرض السعر، ملاحظات التسليم…"
                className="form-input"
                style={{ height: 'auto', paddingTop: 8, paddingBottom: 8 }}
              />
            </Field>

            <div className="flex items-center gap-3 border-t border-[var(--line)] pt-6">
              <Button variant="primary" size="lg" icon={<Save size={16} />}>
                إنشاء الأمر
              </Button>
              <Link
                href="/orders"
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
        textarea.form-input { resize: vertical; min-height: 80px; line-height: 1.5; }
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
