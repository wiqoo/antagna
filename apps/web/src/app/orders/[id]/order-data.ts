import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export type OrderHeader = {
  id: string;
  code: string;
  vendorName: string;
  status: string;
  totalSar: string | null;
  currency: string;
  orderedAt: string | null;
  expectedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type OrderItem = {
  id: string;
  description: string;
  qty: number;
  unitPriceSar: string | null;
  equipmentId: string | null;
  equipmentCode: string | null;
};

/** Fetch a PO header + its line items. Returns null when the order is missing. */
export async function fetchOrder(
  id: string,
): Promise<{ order: OrderHeader; items: OrderItem[] } | null> {
  const [hdrR, itemsR] = await Promise.all([
    db.execute(sql`
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
        po.notes,
        prof.display_name AS "createdByName",
        po.created_at AS "createdAt"
      FROM purchase_orders po
      LEFT JOIN profiles prof ON prof.id = po.created_by
      WHERE po.id = ${id}::uuid
      LIMIT 1
    `),
    db.execute(sql`
      SELECT
        i.id::text AS id,
        i.description,
        i.qty,
        i.unit_price_sar AS "unitPriceSar",
        i.equipment_id::text AS "equipmentId",
        e.code AS "equipmentCode"
      FROM purchase_order_items i
      LEFT JOIN equipment e ON e.id = i.equipment_id
      WHERE i.order_id = ${id}::uuid
      ORDER BY i.id
    `),
  ]);

  const order = rows<OrderHeader>(hdrR)[0];
  if (!order) return null;
  return { order, items: rows<OrderItem>(itemsR) };
}
