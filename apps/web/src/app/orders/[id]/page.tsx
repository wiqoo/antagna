import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { PageHeader, Card, CardHeader, StatusPill, EmptyState, MoneyDisplay } from '@antagna/ui';
import { ArrowLeft, Printer, Package, Calendar, Truck, CheckCircle2 } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { fetchOrder } from './order-data';
import { OrderStatusControls } from './order-status-controls';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  draft: 'neutral',
  sent: 'info',
  received: 'success',
  cancelled: 'danger',
};
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

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/orders/${id}`);

  await requirePermission('procurement.manage');

  const data = await fetchOrder(id);
  if (!data) notFound();
  const { order, items } = data;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/orders">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> أوامر الشراء
      </Link>

      <PageHeader
        eyebrow={order.code}
        title={order.vendorName}
        subtitle={`أمر شراء · ${items.length} بند · ${order.currency}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={STATUS_TONE[order.status] ?? 'neutral'}>
              {STATUS_AR[order.status] ?? order.status}
            </StatusPill>
            <Link
              href={`/orders/${order.id}/receipt`}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              <Printer size={14} /> سند الاستلام
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Summary */}
        <Card>
          <CardHeader title="ملخّص الأمر" subtitle="المورّد والتواريخ والإجمالي" />
          <dl className="mt-4 space-y-2 text-[13px]">
            <Row k="الكود" v={order.code} mono />
            <Row k="المورّد" v={order.vendorName} />
            <Row
              k="تاريخ الطلب"
              v={
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} className="text-[var(--text-dim)]" />
                  {fmtDate(order.orderedAt)}
                </span>
              }
            />
            <Row
              k="التسليم المتوقَّع"
              v={
                <span className="inline-flex items-center gap-1">
                  <Truck size={12} className="text-[var(--text-dim)]" />
                  {fmtDate(order.expectedAt)}
                </span>
              }
            />
            <Row
              k="تاريخ الاستلام"
              v={
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-[var(--text-dim)]" />
                  {fmtDate(order.receivedAt)}
                </span>
              }
            />
            {order.createdByName && <Row k="أنشأه" v={order.createdByName} />}
            <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-2">
              <dt className="text-[var(--text-dim)]">الإجمالي</dt>
              <dd className="text-[15px] font-semibold">
                <MoneyDisplay amount={order.totalSar} currency={order.currency} />
              </dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
              تغيير الحالة
            </p>
            <OrderStatusControls orderId={order.id} current={order.status} />
          </div>

          {order.notes && (
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                ملاحظات
              </p>
              <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">{order.notes}</p>
            </div>
          )}
        </Card>

        {/* Line items */}
        <div className="lg:col-span-2">
          <Card padded={false}>
            <div className="p-6 pb-4">
              <CardHeader title="بنود الأمر" subtitle={`${items.length} بند`} />
            </div>
            {items.length === 0 ? (
              <EmptyState
                icon={<Package size={20} />}
                title="لا بنود"
                description="هذا الأمر لا يحتوي على بنود بعد."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                      <th className="px-5 py-3 text-start">الوصف</th>
                      <th className="px-5 py-3 text-start">معدّة</th>
                      <th className="px-5 py-3 text-end">الكمية</th>
                      <th className="px-5 py-3 text-end">سعر الوحدة</th>
                      <th className="px-5 py-3 text-end">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {items.map((it) => {
                      const line = it.qty * Number(it.unitPriceSar ?? 0);
                      return (
                        <tr key={it.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="px-5 py-3.5 text-[var(--text)]">{it.description}</td>
                          <td className="px-5 py-3.5">
                            {it.equipmentId ? (
                              <Link
                                href={`/equipment/${it.equipmentId}`}
                                className="font-mono text-[11px] text-[var(--text-dim)] hover:text-[var(--accent)]"
                              >
                                {it.equipmentCode ?? '—'}
                              </Link>
                            ) : (
                              <span className="text-[var(--text-dim)]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-end font-mono text-[12px] text-[var(--text-muted)] tabular">
                            {it.qty}
                          </td>
                          <td className="px-5 py-3.5 text-end">
                            <MoneyDisplay amount={it.unitPriceSar} currency={order.currency} />
                          </td>
                          <td className="px-5 py-3.5 text-end">
                            <MoneyDisplay amount={line} currency={order.currency} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--line)]">
                      <td colSpan={4} className="px-5 py-3.5 text-end text-[12px] text-[var(--text-dim)]">
                        الإجمالي
                      </td>
                      <td className="px-5 py-3.5 text-end text-[14px] font-semibold">
                        <MoneyDisplay amount={order.totalSar} currency={order.currency} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--text-dim)]">{k}</dt>
      <dd className={'text-[var(--text)] ' + (mono ? 'font-mono text-[12px]' : '')}>{v}</dd>
    </div>
  );
}
