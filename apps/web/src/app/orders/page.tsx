import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requirePermission } from '@/lib/authz';
import { PageHeader, StatBox } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Plus, ShoppingCart, Send, PackageCheck, Wallet } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { OrdersList, type OrderRow } from './OrdersList';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

/**
 * /orders — Procurement / Purchase Orders (volt-os /orders parity).
 *
 * A purchase_orders header + its purchase_order_items lines: gear/services
 * bought from a vendor, tracked from draft → sent → received. This is
 * operational procurement (PO references); invoicing/ZATCA stays in Dafterah
 * (D-022). Gated on procurement.manage.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vendor?: string }>;
}) {
  const sp = await searchParams;
  const initialFilters: Record<string, string> = {};
  if (sp.status?.trim()) initialFilters.status = sp.status.trim();
  if (sp.vendor?.trim()) initialFilters.vendor = sp.vendor.trim();

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/orders');

  // Page guard: lacking procurement.manage → /dashboard.
  await requirePermission('procurement.manage');

  const ordersR = await db.execute(sql`
    SELECT
      po.id::text AS id,
      po.code,
      po.vendor_name AS "vendorName",
      po.status::text AS status,
      po.total_sar AS "totalSar",
      po.currency,
      po.ordered_at AS "orderedAt",
      po.expected_at AS "expectedAt",
      po.received_at AS "receivedAt",
      COALESCE(i.cnt, 0)::int AS "itemCount"
    FROM purchase_orders po
    LEFT JOIN (
      SELECT order_id, count(*) AS cnt
      FROM purchase_order_items
      GROUP BY order_id
    ) i ON i.order_id = po.id
    ORDER BY po.created_at DESC
    LIMIT 300
  `);

  const items = rows<OrderRow>(ordersR);

  const totalOpen = items
    .filter((o) => o.status === 'draft' || o.status === 'sent')
    .reduce((acc, o) => acc + Number(o.totalSar ?? 0), 0);
  const sentCount = items.filter((o) => o.status === 'sent').length;
  const receivedCount = items.filter((o) => o.status === 'received').length;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/orders">
      <PageHeader
        eyebrow="Procurement"
        title="أوامر الشراء"
        subtitle="إدارة المشتريات من المورّدين — من المسودّة حتى الاستلام"
        action={
          <Link
            href="/orders/new"
            className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} />
            أمر شراء جديد
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBox label="إجمالي الأوامر" value={items.length} icon={<ShoppingCart size={18} />} />
        <StatBox label="مُرسَلة" value={sentCount} icon={<Send size={18} />} tone="accent" />
        <StatBox
          label="مُستلَمة"
          value={receivedCount}
          icon={<PackageCheck size={18} />}
          tone="success"
        />
        <StatBox
          label="قيمة مفتوحة (ر.س)"
          value={Math.round(totalOpen)}
          icon={<Wallet size={18} />}
          format={new Intl.NumberFormat('en-US').format(Math.round(totalOpen))}
        />
      </section>

      <OrdersList items={items} initialFilters={initialFilters} />
    </Shell>
  );
}
