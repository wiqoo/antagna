/**
 * Orders / Procurement domain — purchase orders to vendors.
 *
 * volt-os /orders parity: a purchase_orders header + purchase_order_items lines.
 * Antagna stores PO references for procurement tracking; finance/invoicing still
 * lives in Dafterah (D-022) — this is operational procurement, not accounting.
 *
 * Gated by the `procurement.manage` permission key (seeded in the migration,
 * granted to system_admin / general_manager / procurement).
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';
import { equipment } from './equipment';

// ── enum ────────────────────────────────────────────────────────────────────

export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', [
  'draft',
  'sent',
  'received',
  'cancelled',
]);

// ── purchase_orders (header) ──────────────────────────────────────────────────

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  vendorName: text('vendor_name').notNull(),
  status: purchaseOrderStatusEnum('status').notNull().default('draft'),
  totalSar: numeric('total_sar', { precision: 14, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('SAR'),
  orderedAt: timestamp('ordered_at', { withTimezone: true }),
  expectedAt: timestamp('expected_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── purchase_order_items (lines) ──────────────────────────────────────────────

export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    qty: integer('qty').notNull().default(1),
    unitPriceSar: numeric('unit_price_sar', { precision: 14, scale: 2 }).notNull().default('0'),
    equipmentId: uuid('equipment_id').references(() => equipment.id),
  },
  (t) => [check('po_item_qty_positive', sql`${t.qty} > 0`)],
);

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
