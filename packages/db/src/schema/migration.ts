/**
 * Pillar 15 — Migration & Launch staging tables.
 *
 * Used by `scripts/migrate-from-volt-os.ts` (which Mohammed runs against the
 * legacy DB once Pillar 15 starts). Data lands in `legacy_*` staging tables
 * first; a second pass maps to the canonical schema with FK validation.
 *
 * The legacy DB itself is HANDS-OFF until Mohammed runs the export per his
 * 2026-05-15 directive.
 */
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const migrationRuns = pgTable('migration_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(), // 'volt_os_legacy'
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'ok' | 'failed' | 'rolled_back'

  startedAt: timestamp('started_at', { withTimezone: true }).notNull().default(sql`now()`),
  finishedAt: timestamp('finished_at', { withTimezone: true }),

  rowsRead: jsonb('rows_read').notNull().default({}), // { equipment: 162, clients: 47, projects: 12 }
  rowsWritten: jsonb('rows_written').notNull().default({}),
  rowsSkipped: jsonb('rows_skipped').notNull().default({}),

  errorMessage: text('error_message'),
  dryRun: boolean('dry_run').notNull().default(false),
  notes: text('notes'),
});

export const legacyEquipmentImport = pgTable('legacy_equipment_import', {
  id: uuid('id').primaryKey().defaultRandom(),
  // The source row in raw form — every column from the legacy `equipment`
  // table comes in here so we can re-process without re-pulling.
  legacyId: text('legacy_id'),
  legacyPayload: jsonb('legacy_payload').notNull(),

  // Mapping outcome
  newEquipmentId: uuid('new_equipment_id'),
  newGroupId: uuid('new_group_id'),
  mapStatus: text('map_status').notNull().default('pending'), // 'pending' | 'mapped' | 'skipped' | 'failed'
  mapNotes: text('map_notes'),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const legacyClientImport = pgTable('legacy_client_import', {
  id: uuid('id').primaryKey().defaultRandom(),
  legacyId: text('legacy_id'),
  legacyPayload: jsonb('legacy_payload').notNull(),
  newClientId: uuid('new_client_id'),
  mapStatus: text('map_status').notNull().default('pending'),
  mapNotes: text('map_notes'),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const legacyProjectImport = pgTable('legacy_project_import', {
  id: uuid('id').primaryKey().defaultRandom(),
  legacyId: text('legacy_id'),
  legacyPayload: jsonb('legacy_payload').notNull(),
  newProjectId: uuid('new_project_id'),
  mapStatus: text('map_status').notNull().default('pending'),
  mapNotes: text('map_notes'),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type MigrationRun = typeof migrationRuns.$inferSelect;
export type LegacyEquipmentImport = typeof legacyEquipmentImport.$inferSelect;
export type LegacyClientImport = typeof legacyClientImport.$inferSelect;
export type LegacyProjectImport = typeof legacyProjectImport.$inferSelect;
