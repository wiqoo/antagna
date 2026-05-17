/**
 * Pillar 2 §8 — Equipment domain.
 * + Pillar 16 §B.5 (equipment_groups counted by model ~60)
 * + Pillar 16 §D.5 (equipment_profiles for per-context settings)
 */
import {
  pgTable,
  uuid,
  bigserial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';
import { projects } from './projects';

// ── enums ──────────────────────────────────────────────────────────────────────

export const equipmentTrackingModeEnum = pgEnum('equipment_tracking_mode', ['unit', 'bulk']);

export const equipmentStatusEnum = pgEnum('equipment_status', [
  'available',
  'checked_out',
  'repair',
  'lost',
  'retired',
]);

// ── equipment_groups ──────────────────────────────────────────────────────────

export const equipmentGroups = pgTable('equipment_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  category: text('category'),
  description: text('description'),
});

// ── equipment ─────────────────────────────────────────────────────────────────

export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  groupId: uuid('group_id').references(() => equipmentGroups.id),

  category: text('category').notNull(),
  manufacturer: text('manufacturer'),
  model: text('model').notNull(),
  modelNameAr: text('model_name_ar'),
  serialNumber: text('serial_number'),

  trackingMode: equipmentTrackingModeEnum('tracking_mode').notNull().default('unit'),
  quantityTotal: integer('quantity_total').notNull().default(1),

  status: equipmentStatusEnum('status').notNull().default('available'),
  currentLocation: text('current_location').notNull().default('warehouse'),

  purchaseDate: text('purchase_date'),
  purchasePriceSar: numeric('purchase_price_sar', { precision: 12, scale: 2 }),
  insuranceValueSar: numeric('insurance_value_sar', { precision: 12, scale: 2 }),
  warrantyUntil: text('warranty_until'),

  depreciationMethod: text('depreciation_method'),
  usefulLifeMonths: integer('useful_life_months'),
  currentBookValueSar: numeric('current_book_value_sar', { precision: 12, scale: 2 }),

  requiresCharging: boolean('requires_charging').notNull().default(false),
  lastChargedAt: timestamp('last_charged_at', { withTimezone: true }),

  photoUrl: text('photo_url'),
  manualUrl: text('manual_url'),

  specs: jsonb('specs').notNull().default({}),

  isKitItem: boolean('is_kit_item').notNull().default(false),
  parentKitId: uuid('parent_kit_id'),

  notes: text('notes'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── kits + kit_items ──────────────────────────────────────────────────────────

export const kits = pgTable('kits', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  description: text('description'),
  primaryEquipmentId: uuid('primary_equipment_id').references(() => equipment.id),
  active: boolean('active').notNull().default(true),
});

export const kitItems = pgTable('kit_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  kitId: uuid('kit_id')
    .notNull()
    .references(() => kits.id, { onDelete: 'cascade' }),
  equipmentId: uuid('equipment_id').references(() => equipment.id),
  equipmentGroupId: uuid('equipment_group_id').references(() => equipmentGroups.id),
  quantity: integer('quantity').notNull().default(1),
  isMandatory: boolean('is_mandatory').notNull().default(false),
  position: integer('position').notNull().default(0),
  notes: text('notes'),
});

// ── equipment_reservations (no_overlap exclusion in migration) ────────────────

export const equipmentReservations = pgTable(
  'equipment_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    equipmentId: uuid('equipment_id').references(() => equipment.id),
    groupId: uuid('group_id').references(() => equipmentGroups.id),

    projectId: uuid('project_id').references(() => projects.id),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),

    reservedById: uuid('reserved_by_id').references(() => profiles.id),
    status: text('status').notNull().default('reserved'), // 'reserved' | 'checked_out' | 'returned' | 'cancelled'

    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    check(
      'reservation_target',
      sql`${t.equipmentId} IS NOT NULL OR ${t.groupId} IS NOT NULL`,
    ),
    check('reservation_time', sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

// ── equipment_activity_log ────────────────────────────────────────────────────

export const equipmentActivityLog = pgTable('equipment_activity_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  equipmentId: uuid('equipment_id')
    .notNull()
    .references(() => equipment.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  summary: text('summary'),
  metadata: jsonb('metadata').default({}),
  actorId: uuid('actor_id').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── equipment_profiles (Pillar 16 §D.5 — per-context settings) ────────────────

export const equipmentProfiles = pgTable('equipment_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  equipmentId: uuid('equipment_id')
    .notNull()
    .references(() => equipment.id),
  contextType: text('context_type').notNull(), // 'location' | 'client' | 'subject_type' | 'general'
  contextId: uuid('context_id'),
  contextLabel: text('context_label'),
  recommendedSettings: jsonb('recommended_settings'),
  knownIssues: text('known_issues'),
  notes: text('notes'),
  derivedFromProjectIds: uuid('derived_from_project_ids').array(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type Equipment = typeof equipment.$inferSelect;
export type EquipmentGroup = typeof equipmentGroups.$inferSelect;
export type EquipmentReservation = typeof equipmentReservations.$inferSelect;
export type Kit = typeof kits.$inferSelect;
export type EquipmentProfile = typeof equipmentProfiles.$inferSelect;
