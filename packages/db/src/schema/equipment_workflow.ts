/**
 * Pillar 6 §3 — Equipment workflow tables on top of Pillar 2 §8.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  numeric,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';
import { equipment, equipmentGroups, equipmentReservations } from './equipment';

// ── enums ──────────────────────────────────────────────────────────────────────

export const compatibilityVerdictEnum = pgEnum('compatibility_verdict', [
  'compatible',
  'incompatible',
  'unverified',
]);

// ── compatibility_rules ───────────────────────────────────────────────────────

export const compatibilityRules = pgTable('compatibility_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemAId: uuid('item_a_id').references(() => equipment.id),
  itemBId: uuid('item_b_id').references(() => equipment.id),
  groupAId: uuid('group_a_id').references(() => equipmentGroups.id),
  groupBId: uuid('group_b_id').references(() => equipmentGroups.id),
  tagA: text('tag_a'),
  tagB: text('tag_b'),

  verdict: compatibilityVerdictEnum('verdict').notNull(),
  reasonAr: text('reason_ar'),
  reasonEn: text('reason_en'),
  source: text('source').notNull(), // 'manual' | 'promoted_from_feedback' | 'ai_inferred'
  verifiedCount: integer('verified_count').notNull().default(1),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── compatibility_feedback ────────────────────────────────────────────────────

export const compatibilityFeedback = pgTable(
  'compatibility_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reservationId: uuid('reservation_id').references(() => equipmentReservations.id),
    itemAId: uuid('item_a_id')
      .notNull()
      .references(() => equipment.id),
    itemBId: uuid('item_b_id')
      .notNull()
      .references(() => equipment.id),
    verdict: text('verdict').notNull(), // 'worked' | 'issue'
    notes: text('notes'),
    reportedById: uuid('reported_by_id').references(() => profiles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [check('feedback_ordered', sql`${t.itemAId} < ${t.itemBId}`)],
);

// ── kit_suggestions ───────────────────────────────────────────────────────────

export const kitSuggestions = pgTable('kit_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  primaryEquipmentGroupId: uuid('primary_equipment_group_id')
    .notNull()
    .references(() => equipmentGroups.id),
  suggestedItemGroupId: uuid('suggested_item_group_id').references(() => equipmentGroups.id),
  suggestedItemId: uuid('suggested_item_id').references(() => equipment.id),
  quantity: integer('quantity').notNull().default(1),
  importance: text('importance').notNull(), // 'mandatory' | 'recommended' | 'optional'
  reasonAr: text('reason_ar'),
  notes: text('notes'),
  position: integer('position').notNull().default(0),
});

// ── equipment_repairs ─────────────────────────────────────────────────────────

export const equipmentRepairs = pgTable('equipment_repairs', {
  id: uuid('id').primaryKey().defaultRandom(),
  equipmentId: uuid('equipment_id')
    .notNull()
    .references(() => equipment.id),
  reportedById: uuid('reported_by_id').references(() => profiles.id),
  reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().default(sql`now()`),
  issueDescription: text('issue_description').notNull(),
  severity: text('severity').notNull(), // 'minor' | 'major' | 'unusable'
  vendor: text('vendor'),
  costSar: numeric('cost_sar', { precision: 10, scale: 2 }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  returnedAt: timestamp('returned_at', { withTimezone: true }),
  status: text('status').notNull().default('reported'), // 'reported' | 'sent' | 'in_repair' | 'returned' | 'declined'
  notes: text('notes'),
});

export type CompatibilityRule = typeof compatibilityRules.$inferSelect;
export type CompatibilityFeedback = typeof compatibilityFeedback.$inferSelect;
export type KitSuggestion = typeof kitSuggestions.$inferSelect;
export type EquipmentRepair = typeof equipmentRepairs.$inferSelect;
