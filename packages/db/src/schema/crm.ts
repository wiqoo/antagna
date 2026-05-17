/**
 * Pillar 4 §3 — CRM schema additions on top of Pillar 2's clients/contacts.
 *
 * Tables here:
 *   - leads (pre-project inbound funnel)
 *   - client_assignments (which Volt person owns this client; one primary AM)
 *   - client_health_snapshots (nightly pg_cron rollup)
 *   - inbound_email_routes (the rule engine that routes info@voltsaudi.com mail)
 *
 * The business-logic bits (email-in resolver, lead→project conversion) land in
 * Pillars 8 (Communications) and 10 (AI) when their dependencies exist.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  pgEnum,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';
import { clients, contacts } from './orgs';
import { projects } from './projects';

// ── enums ──────────────────────────────────────────────────────────────────────

export const leadStatusEnum = pgEnum('lead_status', [
  'new',
  'qualified',
  'nurturing',
  'proposal_sent',
  'won',
  'lost',
  'ghosted',
]);

// ── leads ─────────────────────────────────────────────────────────────────────

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(), // LEAD-NNNN via sequence in migration
  source: text('source'), // 'email_inbound' | 'referral' | 'cold_outreach' | 'social' | 'event'
  sourceDetail: text('source_detail'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().default(sql`now()`),

  inboundEmailMessageId: text('inbound_email_message_id'),
  inboundThreadId: text('inbound_thread_id'),

  clientId: uuid('client_id').references(() => clients.id),
  contactId: uuid('contact_id').references(() => contacts.id),
  unmatchedFromEmail: text('unmatched_from_email'),
  unmatchedFromName: text('unmatched_from_name'),

  status: leadStatusEnum('status').notNull().default('new'),
  estimatedValueSar: numeric('estimated_value_sar', { precision: 12, scale: 2 }),
  temperatureScore: integer('temperature_score'), // 0-100, AI-derived

  aiSummary: text('ai_summary'),
  aiSuggestedAction: text('ai_suggested_action'),
  aiAnalyzedAt: timestamp('ai_analyzed_at', { withTimezone: true }),

  convertedToProjectId: uuid('converted_to_project_id').references(() => projects.id),
  lostReason: text('lost_reason'),
  lostAt: timestamp('lost_at', { withTimezone: true }),

  assignedToProfileId: uuid('assigned_to_profile_id').references(() => profiles.id),

  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── client_assignments ───────────────────────────────────────────────────────

export const clientAssignments = pgTable(
  'client_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id),
    role: text('role').notNull(), // 'primary_am' | 'secondary_am' | 'pm_alias' | 'observer'
    active: boolean('active').notNull().default(true),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().default(sql`now()`),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('client_one_primary_am')
      .on(t.clientId)
      .where(sql`role = 'primary_am' AND active = true`),
  ],
);

// ── client_health_snapshots ──────────────────────────────────────────────────

export const clientHealthSnapshots = pgTable(
  'client_health_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    snapshotDate: text('snapshot_date').notNull(), // YYYY-MM-DD

    totalRevenueSar: numeric('total_revenue_sar', { precision: 14, scale: 2 }),
    totalProjectsCount: integer('total_projects_count'),
    activeProjectsCount: integer('active_projects_count'),
    lostProjectsCount: integer('lost_projects_count'),

    averagePaymentDays: integer('average_payment_days'),
    outstandingArSar: numeric('outstanding_ar_sar', { precision: 14, scale: 2 }),

    lastProjectAt: timestamp('last_project_at', { withTimezone: true }),
    daysSinceLastProject: integer('days_since_last_project'),
    retainerStatus: text('retainer_status'), // 'active' | 'lapsed' | 'never'

    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [unique('client_health_per_day').on(t.clientId, t.snapshotDate)],
);

// ── inbound_email_routes ─────────────────────────────────────────────────────

export const inboundEmailRoutes = pgTable('inbound_email_routes', {
  id: uuid('id').primaryKey().defaultRandom(),
  position: integer('position').notNull().default(0),

  // Match conditions (all set ones must match)
  matchFromContains: text('match_from_contains'),
  matchToContains: text('match_to_contains'),
  matchSubjectRegex: text('match_subject_regex'),
  matchDomain: text('match_domain'),

  // Actions
  assignToProfileId: uuid('assign_to_profile_id').references(() => profiles.id),
  setLabelKey: text('set_label_key'),
  setStatus: text('set_status'),
  createLeadIfNew: boolean('create_lead_if_new').notNull().default(true),
  notifyChannel: text('notify_channel'),

  active: boolean('active').notNull().default(true),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type Lead = typeof leads.$inferSelect;
export type ClientAssignment = typeof clientAssignments.$inferSelect;
export type ClientHealthSnapshot = typeof clientHealthSnapshots.$inferSelect;
export type InboundEmailRoute = typeof inboundEmailRoutes.$inferSelect;
