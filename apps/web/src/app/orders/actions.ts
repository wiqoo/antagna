'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { parseNum, parseDate, parseStr } from '@/lib/parse';

type LineInput = {
  description: string;
  qty: number;
  unitPriceSar: number;
  equipmentId: string | null;
};

/**
 * Pull repeated line-item fields out of a FormData. The /orders/new form posts
 * arrays: item_description[], item_qty[], item_unit_price[], item_equipment[].
 * Empty rows (no description) are skipped.
 */
function readLineItems(formData: FormData): LineInput[] {
  const descs = formData.getAll('item_description');
  const qtys = formData.getAll('item_qty');
  const prices = formData.getAll('item_unit_price');
  const equips = formData.getAll('item_equipment');

  const out: LineInput[] = [];
  for (let i = 0; i < descs.length; i++) {
    const description = parseStr(descs[i]);
    if (!description) continue;
    const qtyParsed = parseNum(qtys[i]);
    const qty = qtyParsed != null && qtyParsed > 0 ? Math.round(qtyParsed) : 1;
    const unitPriceSar = parseNum(prices[i]) ?? 0;
    const equipmentId = parseStr(equips[i]);
    out.push({ description, qty, unitPriceSar, equipmentId });
  }
  return out;
}

/** Create a purchase order + its line items in one transaction. */
export async function createPurchaseOrder(formData: FormData): Promise<void> {
  const aid = await requirePermissionAction('procurement.manage');

  const codeRaw = formData.get('code')?.toString().trim().toUpperCase();
  const vendorName = parseStr(formData.get('vendorName'));
  const status = parseStr(formData.get('status')) ?? 'draft';
  const currency = (parseStr(formData.get('currency')) ?? 'SAR').toUpperCase();
  const orderedAt = parseDate(formData.get('orderedAt'));
  const expectedAt = parseDate(formData.get('expectedAt'));
  const notes = parseStr(formData.get('notes'));

  if (!vendorName) throw new Error('vendor_name required');

  const allowedStatus = ['draft', 'sent', 'received', 'cancelled'];
  const safeStatus = allowedStatus.includes(status) ? status : 'draft';

  // Auto-generate a code if none supplied (PO-XXXXX from the timestamp).
  const code = codeRaw || `PO-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const items = readLineItems(formData);
  const total = items.reduce((acc, it) => acc + it.qty * it.unitPriceSar, 0);

  let orderId: string | undefined;
  await withActor(aid, async (tx) => {
    const res = await tx.execute<{ id: string }>(sql`
      INSERT INTO purchase_orders (
        code, vendor_name, status, total_sar, currency,
        ordered_at, expected_at, notes, created_by
      )
      VALUES (
        ${code}, ${vendorName}, ${safeStatus}::purchase_order_status,
        ${total}::numeric, ${currency},
        ${orderedAt}, ${expectedAt}, ${notes}, ${aid}::uuid
      )
      RETURNING id::text AS id
    `);
    orderId = (res as unknown as Array<{ id: string }>)[0]?.id;
    if (!orderId) throw new Error('insert failed');

    if (items.length > 0) {
      await tx.execute(sql`
        INSERT INTO purchase_order_items (order_id, description, qty, unit_price_sar, equipment_id)
        VALUES ${sql.join(
          items.map(
            (it) => sql`(
              ${orderId}::uuid, ${it.description}, ${it.qty}, ${it.unitPriceSar}::numeric,
              ${it.equipmentId ? sql`${it.equipmentId}::uuid` : sql`NULL`}
            )`,
          ),
          sql`, `,
        )}
      `);
    }
  });

  revalidatePath('/orders');
  redirect(`/orders/${orderId}`);
}

/**
 * Move a PO to a new status. Stamps received_at when it is marked received and
 * ordered_at when it is sent (if not already stamped).
 */
export async function setPurchaseOrderStatus(
  orderId: string,
  status: string,
): Promise<void> {
  const aid = await requirePermissionAction('procurement.manage');
  const allowed = ['draft', 'sent', 'received', 'cancelled'];
  if (!allowed.includes(status)) throw new Error('bad status');

  await withActor(aid, (tx) =>
    tx.execute(sql`
      UPDATE purchase_orders SET
        status = ${status}::purchase_order_status,
        ordered_at = CASE
          WHEN ${status} = 'sent' AND ordered_at IS NULL THEN now()
          ELSE ordered_at END,
        received_at = CASE
          WHEN ${status} = 'received' THEN now()
          WHEN ${status} <> 'received' THEN NULL
          ELSE received_at END,
        updated_at = now()
      WHERE id = ${orderId}::uuid
    `),
  );

  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
}
