# Pillar 2 — Money (schema-only) & Equipment

> Part of **Pillar 2 (Data Model)** — see [`../pillar-02-data-model.md`](../pillar-02-data-model.md) for overview + index.
> Sections: **§7 MONEY**, **§8 EQUIPMENT**.
> ⚠️ **§7 is largely moot per D-022** — Dafterah owns invoicing; Antagna keeps these tables as stubs only.

---

## 7. MONEY — Schema-Only (Module Deferred)

These tables exist so the data model is complete, but the Finance MODULE (invoicing UI, full AR/AP) is deferred to Phase 2 per Mohammed's scope decision. The tables let us start recording quotes + invoices alongside projects so when the module activates, history exists.

### 7.1 `quotes`

```typescript
export const quoteStatusEnum = pgEnum("quote_status", [
  "draft", "sent", "accepted", "rejected", "expired", "superseded"
]);

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                     // QUO-0001
  projectId: uuid("project_id").references(() => projects.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),

  status: quoteStatusEnum("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  parentQuoteId: uuid("parent_quote_id"),                    // when revising

  // Amounts (SAR)
  subtotalSar: numeric("subtotal_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  discountSar: numeric("discount_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  vatRate: numeric("vat_rate", { precision: 5, scale: 4 }).notNull().default("0.15"),
  vatSar: numeric("vat_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSar: numeric("total_sar", { precision: 12, scale: 2 }).notNull().default("0"),

  // Dates
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  validUntilAt: timestamp("valid_until_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),

  // Payment terms
  paymentTermsText: text("payment_terms_text"),             // free-form for now; structured in Phase 2

  // External refs
  pdfUrl: text("pdf_url"),

  notes: text("notes"),
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quoteLineItems = pgTable("quote_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  quoteId: uuid("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPriceSar: numeric("unit_price_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSar: numeric("total_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  category: text("category"),                               // 'crew', 'equipment', 'location', 'post', ...
});
```

### 7.2 `invoices`

```typescript
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft", "issued", "partially_paid", "paid", "overdue", "cancelled", "written_off"
]);

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                     // INV-00001
  projectId: uuid("project_id").references(() => projects.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  quoteId: uuid("quote_id").references(() => quotes.id),

  status: invoiceStatusEnum("status").notNull().default("draft"),

  // Issued / due
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),

  // Amounts
  subtotalSar: numeric("subtotal_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  vatSar: numeric("vat_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSar: numeric("total_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  paidSar: numeric("paid_sar", { precision: 12, scale: 2 }).notNull().default("0"),

  // ZATCA fields (will populate when e-invoicing is wired)
  zatcaUuid: text("zatca_uuid"),
  zatcaHash: text("zatca_hash"),
  zatcaQrUrl: text("zatca_qr_url"),

  pdfUrl: text("pdf_url"),
  notes: text("notes"),

  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPriceSar: numeric("unit_price_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSar: numeric("total_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  category: text("category"),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amountSar: numeric("amount_sar", { precision: 12, scale: 2 }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  method: text("method"),                                   // 'bank_transfer', 'cheque', 'card', 'cash'
  referenceNumber: text("reference_number"),                // bank ref
  receivedById: uuid("received_by_id").references(() => profiles.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 7.3 Code-generation sequences

```sql
CREATE SEQUENCE IF NOT EXISTS quote_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS invoice_code_seq START WITH 1;

CREATE OR REPLACE FUNCTION fn_next_quote_code() RETURNS text LANGUAGE sql AS $$
  SELECT 'QUO-' || LPAD(nextval('quote_code_seq')::text, 4, '0');
$$;
CREATE OR REPLACE FUNCTION fn_next_invoice_code() RETURNS text LANGUAGE sql AS $$
  SELECT 'INV-' || LPAD(nextval('invoice_code_seq')::text, 5, '0');
$$;

ALTER TABLE quotes ALTER COLUMN code SET DEFAULT fn_next_quote_code();
ALTER TABLE invoices ALTER COLUMN code SET DEFAULT fn_next_invoice_code();
```

### 7.4 Triggers

- `tg_invoice_status_from_payments`: AFTER INSERT/UPDATE/DELETE on payments — recompute `invoice.paid_sar` and `invoice.status` (`paid` if `paid_sar >= total_sar`, `partially_paid` if 0 < paid_sar < total_sar, etc.).
- `tg_quote_total_from_lines`: AFTER any change on quote_line_items — recompute `subtotal_sar`, `vat_sar`, `total_sar`.

### 7.5 RLS

- Read: assignees of the project + finance role + admins.
- Write: account manager + project manager + finance + admins.

---

## 8. EQUIPMENT

### 8.1 `equipment_groups` (model/type for bulk reservation)

```typescript
export const equipmentGroups = pgTable("equipment_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                     // e.g., 'NP-FZ100'
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  category: text("category"),                                // 'camera', 'lens', 'battery', 'lighting', ...
  description: text("description"),
});
```

### 8.2 `equipment`

```typescript
export const equipmentTrackingModeEnum = pgEnum("equipment_tracking_mode", ["unit", "bulk"]);
export const equipmentStatusEnum = pgEnum("equipment_status", ["available", "checked_out", "repair", "lost", "retired"]);

export const equipment = pgTable("equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                     // 'CAM-001', 'BAT-NPFZ100-003'
  groupId: uuid("group_id").references(() => equipmentGroups.id),

  category: text("category").notNull(),                      // 'camera', 'lens', 'battery', 'tripod', ...
  manufacturer: text("manufacturer"),
  model: text("model").notNull(),
  modelNameAr: text("model_name_ar"),
  serialNumber: text("serial_number"),

  trackingMode: equipmentTrackingModeEnum("tracking_mode").notNull().default("unit"),
  quantityTotal: integer("quantity_total").notNull().default(1),

  status: equipmentStatusEnum("status").notNull().default("available"),
  currentLocation: text("current_location").notNull().default("warehouse"),  // 'warehouse', 'in_use', 'repair', 'lost'

  purchaseDate: text("purchase_date"),
  purchasePriceSar: numeric("purchase_price_sar", { precision: 12, scale: 2 }),
  insuranceValueSar: numeric("insurance_value_sar", { precision: 12, scale: 2 }),
  warrantyUntil: text("warranty_until"),

  // Depreciation (data only — finance module computes later)
  depreciationMethod: text("depreciation_method"),         // 'straight_line', 'declining_balance', null
  usefulLifeMonths: integer("useful_life_months"),
  currentBookValueSar: numeric("current_book_value_sar", { precision: 12, scale: 2 }),  // updated by scheduled job

  // Charging (batteries)
  requiresCharging: boolean("requires_charging").notNull().default(false),
  lastChargedAt: timestamp("last_charged_at", { withTimezone: true }),

  // Photo + docs
  photoUrl: text("photo_url"),
  manualUrl: text("manual_url"),

  // Specs (free-form JSON for now; structured indexes come later if needed)
  specs: jsonb("specs").notNull().default({}),

  // Kit membership
  isKitItem: boolean("is_kit_item").notNull().default(false),
  parentKitId: uuid("parent_kit_id"),

  notes: text("notes"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 8.3 `kits` and `kit_items`

```typescript
export const kits = pgTable("kits", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                     // 'KIT-FX6-STD'
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  primaryEquipmentId: uuid("primary_equipment_id").references(() => equipment.id),
  active: boolean("active").notNull().default(true),
});

export const kitItems = pgTable("kit_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  kitId: uuid("kit_id").notNull().references(() => kits.id, { onDelete: "cascade" }),
  equipmentId: uuid("equipment_id").references(() => equipment.id),
  equipmentGroupId: uuid("equipment_group_id").references(() => equipmentGroups.id),
  quantity: integer("quantity").notNull().default(1),
  isMandatory: boolean("is_mandatory").notNull().default(false),
  position: integer("position").notNull().default(0),
  notes: text("notes"),
});
```

### 8.4 `equipment_reservations` (with btree_gist exclusion to prevent overlap)

```typescript
export const equipmentReservations = pgTable("equipment_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  equipmentId: uuid("equipment_id").references(() => equipment.id),
  groupId: uuid("group_id").references(() => equipmentGroups.id),

  projectId: uuid("project_id").references(() => projects.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

  reservedById: uuid("reserved_by_id").references(() => profiles.id),
  status: text("status").notNull().default("reserved"),       // 'reserved', 'checked_out', 'returned', 'cancelled'

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  hasTarget: check("reservation_target", sql`${t.equipmentId} IS NOT NULL OR ${t.groupId} IS NOT NULL`),
  validTimeRange: check("reservation_time", sql`${t.endsAt} > ${t.startsAt}`),
}));
```

The exclusion constraint is added in raw SQL (Drizzle doesn't support it directly):

```sql
-- Block overlapping reservations for the same equipment unit
ALTER TABLE equipment_reservations
  ADD CONSTRAINT no_overlap_per_unit
  EXCLUDE USING gist (
    equipment_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (equipment_id IS NOT NULL AND status IN ('reserved', 'checked_out'));
```

### 8.5 `equipment_activity_log` (per-item event log)

```typescript
export const equipmentActivityLog = pgTable("equipment_activity_log", {
  id: bigserial("id").primaryKey(),
  equipmentId: uuid("equipment_id").notNull().references(() => equipment.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),                  // 'status_change', 'charged', 'repaired', 'firmware_updated', 'inspected'
  summary: text("summary"),
  metadata: jsonb("metadata").default({}),
  actorId: uuid("actor_id").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 8.6 Functions & Triggers for Equipment

```sql
-- Auto-generate codes (prefix per category)
CREATE OR REPLACE FUNCTION fn_next_equipment_code(prefix_in text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE max_n int;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '\d+$') AS int)), 0)
  INTO max_n
  FROM equipment WHERE code LIKE prefix_in || '-%';
  RETURN prefix_in || '-' || LPAD((max_n + 1)::text, 3, '0');
END $$;

-- Sync location based on status + reservations (Pillar 1 helper extended)
CREATE OR REPLACE FUNCTION fn_sync_equipment_location(eq_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  eq_status text;
  has_active_reservation boolean;
BEGIN
  SELECT status INTO eq_status FROM equipment WHERE id = eq_id;
  SELECT EXISTS(
    SELECT 1 FROM equipment_reservations
    WHERE equipment_id = eq_id
      AND status IN ('reserved', 'checked_out')
      AND now() BETWEEN starts_at AND ends_at
  ) INTO has_active_reservation;

  UPDATE equipment SET current_location = CASE
    WHEN eq_status = 'repair' THEN 'repair'
    WHEN eq_status = 'lost' THEN 'lost'
    WHEN has_active_reservation THEN 'in_use'
    ELSE 'warehouse'
  END
  WHERE id = eq_id;
END $$;
```

### 8.7 RLS for Equipment

- Read: all authenticated.
- Write (equipment, kits, reservations): `equipment_manager` capability OR manager+ role OR admin.
- `equipment_activity_log`: read all; insert via trigger only (server-side).

---

