import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { fetchOrder } from '../order-data';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

const STATUS_AR: Record<string, string> = {
  draft: 'مسودّة',
  sent: 'مُرسَل',
  received: 'مُستلَم',
  cancelled: 'ملغى',
};

function fmtDate(v: string | null): string {
  if (!v) return '—';
  return new Date(v).toISOString().slice(0, 10);
}

function fmtMoney(v: number | string | null): string {
  if (v == null || v === '') return '0';
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Print-friendly receipt / PO document for /orders/[id]/receipt. Standalone
 * (no Shell chrome) so it prints clean — A4 white sheet, RTL Arabic, with a
 * print button that is itself hidden in print output.
 */
export default async function OrderReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/orders/${id}/receipt`);

  await requirePermission('procurement.manage');

  const data = await fetchOrder(id);
  if (!data) notFound();
  const { order, items } = data;

  const total = items.reduce((acc, it) => acc + it.qty * Number(it.unitPriceSar ?? 0), 0);

  return (
    <div className="min-h-screen bg-[var(--bg)] py-8 print:bg-white print:py-0" dir="rtl">
      {/* Toolbar — hidden when printing */}
      <div className="mx-auto mb-4 flex max-w-[800px] items-center justify-between px-4 print:hidden">
        <Link
          href={`/orders/${order.id}`}
          className="text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          ← رجوع لتفاصيل الأمر
        </Link>
        <PrintButton />
      </div>

      {/* Receipt sheet */}
      <div className="receipt-sheet mx-auto max-w-[800px] bg-white p-10 text-[#111] shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-[#111] pb-5">
          <div>
            <h1 className="text-2xl font-bold">أمر شراء</h1>
            <p className="mt-1 text-sm text-[#555]">Purchase Order · Volt Production</p>
          </div>
          <div className="text-end">
            <p className="font-mono text-lg font-bold">{order.code}</p>
            <p className="mt-1 text-sm text-[#555]">الحالة: {STATUS_AR[order.status] ?? order.status}</p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#888]">المورّد</p>
            <p className="text-base font-medium">{order.vendorName}</p>
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 text-end">
            <span className="text-[#888]">تاريخ الطلب</span>
            <span className="font-mono">{fmtDate(order.orderedAt)}</span>
            <span className="text-[#888]">التسليم المتوقَّع</span>
            <span className="font-mono">{fmtDate(order.expectedAt)}</span>
            <span className="text-[#888]">تاريخ الاستلام</span>
            <span className="font-mono">{fmtDate(order.receivedAt)}</span>
            <span className="text-[#888]">العملة</span>
            <span className="font-mono">{order.currency}</span>
          </div>
        </section>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-[#111] text-start">
              <th className="py-2 pe-2 text-start font-semibold">#</th>
              <th className="py-2 px-2 text-start font-semibold">الوصف</th>
              <th className="py-2 px-2 text-start font-semibold">معدّة</th>
              <th className="py-2 px-2 text-end font-semibold">الكمية</th>
              <th className="py-2 px-2 text-end font-semibold">سعر الوحدة</th>
              <th className="py-2 ps-2 text-end font-semibold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-[#888]">
                  لا بنود في هذا الأمر.
                </td>
              </tr>
            ) : (
              items.map((it, i) => (
                <tr key={it.id} className="border-b border-[#ddd]">
                  <td className="py-2.5 pe-2 font-mono text-[#888]">{i + 1}</td>
                  <td className="py-2.5 px-2">{it.description}</td>
                  <td className="py-2.5 px-2 font-mono text-[12px] text-[#666]">
                    {it.equipmentCode ?? '—'}
                  </td>
                  <td className="py-2.5 px-2 text-end font-mono">{it.qty}</td>
                  <td className="py-2.5 px-2 text-end font-mono">{fmtMoney(it.unitPriceSar)}</td>
                  <td className="py-2.5 ps-2 text-end font-mono">
                    {fmtMoney(it.qty * Number(it.unitPriceSar ?? 0))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#111]">
              <td colSpan={5} className="py-3 px-2 text-end font-semibold">
                الإجمالي ({order.currency})
              </td>
              <td className="py-3 ps-2 text-end font-mono text-base font-bold">{fmtMoney(total)}</td>
            </tr>
          </tfoot>
        </table>

        {order.notes && (
          <section className="mt-6 text-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#888]">ملاحظات</p>
            <p className="leading-relaxed text-[#333]">{order.notes}</p>
          </section>
        )}

        <footer className="mt-12 grid grid-cols-2 gap-8 border-t border-[#ddd] pt-6 text-sm">
          <div>
            <div className="h-12 border-b border-[#999]" />
            <p className="mt-1 text-[#888]">توقيع المسؤول</p>
          </div>
          <div>
            <div className="h-12 border-b border-[#999]" />
            <p className="mt-1 text-[#888]">توقيع المورّد / الاستلام</p>
          </div>
        </footer>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 16mm; }
          html, body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
