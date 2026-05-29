-- Orders / Procurement domain (volt-os /orders parity).
--
-- purchase_orders (header) + purchase_order_items (lines): gear/services bought
-- from a vendor, tracked draft → sent → received → cancelled. Operational
-- procurement only — invoicing/ZATCA stays in Dafterah (D-022).
--
-- Gated by a NEW permission key `procurement.manage`, granted to the
-- system_admin / general_manager / procurement positions.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Status enum + tables.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_status') THEN
    CREATE TYPE purchase_order_status AS ENUM ('draft', 'sent', 'received', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  vendor_name text NOT NULL,
  status      purchase_order_status NOT NULL DEFAULT 'draft',
  total_sar   numeric(14, 2) NOT NULL DEFAULT 0,
  currency    text NOT NULL DEFAULT 'SAR',
  ordered_at  timestamptz,
  expected_at timestamptz,
  received_at timestamptz,
  notes       text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  description    text NOT NULL,
  qty            integer NOT NULL DEFAULT 1,
  unit_price_sar numeric(14, 2) NOT NULL DEFAULT 0,
  equipment_id   uuid REFERENCES equipment(id),
  CONSTRAINT po_item_qty_positive CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON purchase_orders (status);
CREATE INDEX IF NOT EXISTS purchase_orders_created_at_idx ON purchase_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_order_items_order_idx ON purchase_order_items (order_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Permission key + grants.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO permissions (key, category, description_ar, description_en, risk_level)
VALUES ('procurement.manage', 'procurement',
        'إدارة أوامر الشراء والمشتريات من المورّدين',
        'Manage purchase orders and vendor procurement', 'normal')
ON CONFLICT (key) DO NOTHING;

-- Grant to the admin + procurement positions. general_manager already holds
-- the '*' wildcard, but an explicit row keeps the position×permission matrix
-- honest.
INSERT INTO position_default_permissions (position_key, permission_key)
SELECT p, 'procurement.manage'
FROM unnest(ARRAY['system_admin', 'general_manager', 'procurement']) AS p
ON CONFLICT DO NOTHING;

COMMIT;
