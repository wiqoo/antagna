# Pillar 6 — Equipment & Reservations

**Status:** Planning
**Depends on:** Pillars 1, 2, 3
**Estimated effort:** 2 sessions

Extends Pillar 2's equipment skeleton with smart kit suggestions, compatibility intelligence, the 1-day booking rule, location auto-sync, and repair workflow. Builds on lessons learned from the old VOLT OS schema (which had this stuff but no UI).

---

## 1. Goals

- Smart kit suggestions: pick FX6 → system offers BP-60 battery, V-Mount, CFexpress card.
- Compatibility intelligence: crowd-sourced "worked vs issue" promotes to rules.
- 1-day reservation rule enforced (per Musa3ed's stated standard).
- Equipment location auto-syncs with reservation state (warehouse / in_use / repair / lost).
- Repair workflow with audit trail.
- Battery charging tracker with "stale" alerts.

## 2. Success Criteria

1. Reserve FX6 for next Tue → system suggests bundled items → operator picks → 1 reservation per item created.
2. Same-day reservation attempt rejected with "1-day rule" error.
3. Mark FX6 status `repair` → location auto-updates to `repair` → activity event fires.
4. Two crews try to reserve same camera with overlapping windows → second is rejected.
5. After 30 days unused, battery flagged "stale charge" via scheduled task.

---

## 3. Schema Additions (beyond Pillar 2)

### 3.1 `compatibility_rules` (with promotable feedback)

```typescript
export const compatibilityVerdictEnum = pgEnum("compatibility_verdict", ["compatible", "incompatible", "unverified"]);

export const compatibilityRules = pgTable("compatibility_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Either tag-based or item-based or group-based
  itemAId: uuid("item_a_id").references(() => equipment.id),
  itemBId: uuid("item_b_id").references(() => equipment.id),
  groupAId: uuid("group_a_id").references(() => equipmentGroups.id),
  groupBId: uuid("group_b_id").references(() => equipmentGroups.id),
  tagA: text("tag_a"),
  tagB: text("tag_b"),

  verdict: compatibilityVerdictEnum("verdict").notNull(),
  reasonAr: text("reason_ar"),
  reasonEn: text("reason_en"),
  source: text("source").notNull(),                         // 'manual' | 'promoted_from_feedback' | 'ai_inferred'
  verifiedCount: integer("verified_count").notNull().default(1),
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const compatibilityFeedback = pgTable("compatibility_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  reservationId: uuid("reservation_id").references(() => equipmentReservations.id),
  itemAId: uuid("item_a_id").notNull().references(() => equipment.id),
  itemBId: uuid("item_b_id").notNull().references(() => equipment.id),
  verdict: text("verdict").notNull(),                       // 'worked' | 'issue'
  notes: text("notes"),
  reportedById: uuid("reported_by_id").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Canonicalize pair order so dedup works
  orderedCheck: check("feedback_ordered", sql`${t.itemAId} < ${t.itemBId}`),
}));
```

Promotion rule (run by scheduled task `promote-compat-feedback` weekly):
- 3+ `issue` and 0 `worked` → INSERT `compatibility_rules (verdict='incompatible', source='promoted_from_feedback')`.
- 5+ `worked` and 0 `issue` → INSERT `compatibility_rules (verdict='compatible')`.

### 3.2 `kit_suggestions` (per-primary-item canonical bundles)

```typescript
export const kitSuggestions = pgTable("kit_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  primaryEquipmentGroupId: uuid("primary_equipment_group_id").notNull().references(() => equipmentGroups.id),
  suggestedItemGroupId: uuid("suggested_item_group_id").references(() => equipmentGroups.id),
  suggestedItemId: uuid("suggested_item_id").references(() => equipment.id),
  quantity: integer("quantity").notNull().default(1),
  importance: text("importance").notNull(),                 // 'mandatory' | 'recommended' | 'optional'
  reasonAr: text("reason_ar"),
  notes: text("notes"),
  position: integer("position").notNull().default(0),
});
```

Seed examples:
- FX6 → BP-60 (mandatory), V-Mount (mandatory), CFexpress (mandatory)
- A7/FX3 → NP-FZ100 × 2 (mandatory), CFexpress Type A (mandatory), FX3 Cage (recommended)
- Ronin → V-Mount (mandatory), Dummy Battery (recommended)
- DJI Avata 2 → Propeller guards (mandatory), ND filters (recommended)
- Any GoPro → MicroSDXC (mandatory)

### 3.3 Battery charging tracker (extends `equipment`)

The `equipment.last_charged_at` exists in Pillar 2. Add a scheduled job:

```sql
-- Stale battery flag: never charged OR >30 days since last charge
CREATE OR REPLACE VIEW v_battery_alerts AS
SELECT id, code, model, last_charged_at,
       CASE
         WHEN last_charged_at IS NULL THEN 'never_charged'
         WHEN last_charged_at < now() - interval '30 days' THEN 'stale_charge'
         ELSE 'fresh'
       END AS alert_level
FROM equipment
WHERE requires_charging = true AND status = 'available';
```

Trigger.dev daily task `battery-stale-check`: query the view, notify Musa3ed with the list.

---

## 4. Reservation Workflow

### 4.1 The 1-day rule (enforced)

```sql
CREATE OR REPLACE FUNCTION fn_check_reservation_lead_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.starts_at < now() + interval '1 day'
     AND NOT current_user_has_permission('equipment.reserve_urgent') THEN
    RAISE EXCEPTION 'Reservations require at least 1 day notice (Musa3ed rule). Override permission: equipment.reserve_urgent';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_check_reservation_lead BEFORE INSERT ON equipment_reservations
FOR EACH ROW EXECUTE FUNCTION fn_check_reservation_lead_time();
```

Admin + Musa3ed have `equipment.reserve_urgent` to override.

### 4.2 Reservation lifecycle (in addition to btree_gist exclusion from Pillar 2)

```
created (status='reserved') → checked_out → returned
                            ↘ cancelled
```

Triggered functions:
- `fn_checkout_equipment(reservation_id)`: requires `equipment.checkout` permission. Sets status, updates equipment.current_location.
- `fn_return_equipment(reservation_id, condition_notes)`: sets status `returned`, prompts for condition note. If "damaged", auto-creates a `repair` workflow task.

### 4.3 Location auto-sync (extends Pillar 2's `fn_sync_equipment_location`)

Trigger fires on:
- INSERT/UPDATE/DELETE on `equipment_reservations`.
- UPDATE OF `status` on `equipment`.

Resulting `current_location` is always: max precedence of `repair` > `lost` > `in_use` > `warehouse`.

---

## 5. Smart-Suggest on Reservation

When user reserves Sony FX6:
1. Frontend hits `/api/equipment/kit-suggestions?primaryGroup=fx6`.
2. Server returns `kit_suggestions` rows for that group.
3. UI shows: "FX6 kit usually includes: ☑ BP-60 battery, ☑ V-Mount × 2, ☑ CFexpress 256GB. Add to reservation?"
4. User confirms → bulk-insert reservations for each picked item with same time window.

```sql
CREATE OR REPLACE FUNCTION fn_suggest_kit_for_equipment(p_equipment_id uuid)
RETURNS TABLE(
  suggestion_id uuid,
  suggested_item_id uuid,
  suggested_group_id uuid,
  quantity int,
  importance text,
  reason_ar text
) LANGUAGE sql STABLE AS $$
  SELECT ks.id, ks.suggested_item_id, ks.suggested_item_group_id, ks.quantity, ks.importance, ks.reason_ar
  FROM kit_suggestions ks
  JOIN equipment e ON e.id = p_equipment_id
  WHERE ks.primary_equipment_group_id = e.group_id
  ORDER BY
    CASE ks.importance WHEN 'mandatory' THEN 1 WHEN 'recommended' THEN 2 ELSE 3 END,
    ks.position;
$$;
```

---

## 6. Repair Workflow

```typescript
export const equipmentRepairs = pgTable("equipment_repairs", {
  id: uuid("id").primaryKey().defaultRandom(),
  equipmentId: uuid("equipment_id").notNull().references(() => equipment.id),
  reportedById: uuid("reported_by_id").references(() => profiles.id),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
  issueDescription: text("issue_description").notNull(),
  severity: text("severity").notNull(),                     // 'minor' | 'major' | 'unusable'
  vendor: text("vendor"),
  costSar: numeric("cost_sar", { precision: 10, scale: 2 }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  status: text("status").notNull().default("reported"),     // 'reported', 'sent', 'in_repair', 'returned', 'declined'
  notes: text("notes"),
});
```

When `severity = 'unusable'`, equipment status auto-flips to `repair`. When `returnedAt` set, status flips back to `available`.

---

## 7. Migration of Legacy Equipment

The 162 equipment items from old DB are imported (Pillar 1 §17 staging table). Pillar 6 maps them into the final schema:

```typescript
// scripts/migrate-equipment-to-final.ts
async function migrate() {
  const legacy = await oldDb.query.legacy_equipment_import.findMany();
  for (const item of legacy) {
    // Resolve or create equipment_group based on category+model
    const groupId = await ensureGroup(item.category, item.model);

    await newDb.insert(equipment).values({
      code: item.code || (await nextCode(item.category)),
      groupId,
      category: item.category,
      manufacturer: item.manufacturer || inferManufacturer(item.model),
      model: item.model,
      modelNameAr: item.model_name_arabic,
      serialNumber: item.serial,
      status: mapStatus(item.status),
      requiresCharging: item.requires_charging ?? inferIsBattery(item),
      lastChargedAt: item.battery_last_charged,
      photoUrl: item.photo_url,
      notes: item.notes,
    });
  }
}
```

Migration includes:
- Group derivation (62 distinct groups from 162 items).
- Photo URL preservation.
- Initial `kit_suggestions` seeded from the old `bundles` table.

---

## 8. Acceptance Checklist

- [ ] `compatibility_rules`, `compatibility_feedback`, `kit_suggestions`, `equipment_repairs` tables + RLS.
- [ ] Seed: 30+ kit_suggestions covering main cameras/lighting/audio.
- [ ] 1-day-rule trigger rejects same-day reservation; admin override works.
- [ ] Smart-suggest endpoint returns expected rows for FX6.
- [ ] btree_gist exclusion test: two overlapping reservations for same camera → second rejected.
- [ ] Location auto-sync test: 4-state transition matrix all produce expected `current_location`.
- [ ] Battery alert view returns expected rows for test data.
- [ ] Repair workflow: report → sent → returned → equipment status syncs.
- [ ] Migration script: 162 items → 162 equipment rows, all with `group_id` set, no FK violations.

---

## 9. Deferred

- **Equipment UI** (catalog grid, lightbox, reservation calendar) → Pillar 12.
- **AI suggesting kits from natural language** ("kit for a 1-day MG shoot in AlUla") → Pillar 10.
- **Equipment-out alerts ("FX6 due back today")** → Pillar 11.

---

## 10. Next: Pillar 7 — Social Media Module

Managed accounts (Abu Luka, Maha, Kabsy), content calendar, publishing tracker, analytics ingestion, cross-link to projects.
