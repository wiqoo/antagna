/**
 * Pillar 9 — Attendance (selfie + GPS audit trail; no face matching per C.2)
 * + KPIs (definitions catalog + snapshot time-series).
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
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';
import { clients } from './orgs';
import { projects } from './projects';

// ── enums ──────────────────────────────────────────────────────────────────────

export const attendanceTypeEnum = pgEnum('attendance_type', [
  'check_in_office',
  'check_out_office',
  'check_in_shoot',
  'check_out_shoot',
  'remote_start',
  'remote_end',
  'leave_start',
  'leave_end',
]);

export const attendanceVerificationEnum = pgEnum('attendance_verification', [
  'verified',
  'flagged_pin_failed',
  'flagged_location_mismatch',
  'flagged_replay_suspected',
  'flagged_clock_skew',
  'manually_overridden',
]);

// ── geo_fences ───────────────────────────────────────────────────────────────

export const geoFences = pgTable('geo_fences', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  centerLat: numeric('center_lat', { precision: 10, scale: 7 }).notNull(),
  centerLng: numeric('center_lng', { precision: 10, scale: 7 }).notNull(),
  radiusMeters: integer('radius_meters').notNull().default(100),
  kind: text('kind').notNull(), // 'office' | 'studio' | 'recurring_client_site'
  clientId: uuid('client_id').references(() => clients.id),
  active: boolean('active').notNull().default(true),
});

// ── attendance_records ───────────────────────────────────────────────────────

export const attendanceRecords = pgTable('attendance_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => profiles.id),
  type: attendanceTypeEnum('type').notNull(),

  // Selfie = audit-trail artifact only per Pillar 16 §C.2 (no biometric embedding).
  selfieUrl: text('selfie_url').notNull(),
  selfieHash: text('selfie_hash'),
  pinVerified: boolean('pin_verified').notNull().default(false),

  gpsLat: numeric('gps_lat', { precision: 10, scale: 7 }),
  gpsLng: numeric('gps_lng', { precision: 10, scale: 7 }),
  gpsAccuracyMeters: numeric('gps_accuracy_meters', { precision: 8, scale: 2 }),
  resolvedLocationLabel: text('resolved_location_label'),
  geoFenceId: uuid('geo_fence_id').references(() => geoFences.id),

  clientTimestamp: timestamp('client_timestamp', { withTimezone: true }),
  serverTimestamp: timestamp('server_timestamp', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  timeDeltaMs: integer('time_delta_ms'),

  associatedProjectId: uuid('associated_project_id').references(() => projects.id),
  associatedCalendarEventId: text('associated_calendar_event_id'),

  verification: attendanceVerificationEnum('verification').notNull(),
  overrideByProfileId: uuid('override_by_profile_id').references(() => profiles.id),
  overrideReason: text('override_reason'),

  deviceInfo: jsonb('device_info'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── kpi_definitions ──────────────────────────────────────────────────────────

export const kpiDefinitions = pgTable('kpi_definitions', {
  key: text('key').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  scope: text('scope').notNull(), // 'person' | 'project' | 'client' | 'company'
  unit: text('unit').notNull(), // 'count' | 'pct' | 'sar' | 'days'
  computeSql: text('compute_sql'),
  thresholdGreen: numeric('threshold_green', { precision: 12, scale: 4 }),
  thresholdAmber: numeric('threshold_amber', { precision: 12, scale: 4 }),
  refreshFrequency: text('refresh_frequency').notNull(), // 'realtime' | 'hourly' | 'daily' | 'weekly'
  active: boolean('active').notNull().default(true),
});

// ── kpi_snapshots ────────────────────────────────────────────────────────────

export const kpiSnapshots = pgTable(
  'kpi_snapshots',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    kpiKey: text('kpi_key')
      .notNull()
      .references(() => kpiDefinitions.key),
    scopeEntityType: text('scope_entity_type'),
    scopeEntityId: uuid('scope_entity_id'),
    periodStart: text('period_start').notNull(),
    periodEnd: text('period_end').notNull(),
    value: numeric('value', { precision: 14, scale: 4 }).notNull(),
    metadata: jsonb('metadata'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    unique('kpi_snapshot_unique').on(t.kpiKey, t.scopeEntityType, t.scopeEntityId, t.periodStart),
    index('kpi_by_time').on(t.kpiKey, t.computedAt.desc()),
  ],
);

export type GeoFence = typeof geoFences.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type KpiDefinition = typeof kpiDefinitions.$inferSelect;
export type KpiSnapshot = typeof kpiSnapshots.$inferSelect;
