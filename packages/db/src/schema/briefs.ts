import {
  pgTable,
  uuid,
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
import { projects } from './projects';

// ── enums ───────────────────────────────────────────────────────────────────────

// Status enum REPLACES the simpler one in §6.2 per Pillar 16 §N.3
// (internal approval state machine).
export const deliverableStatusEnum = pgEnum('deliverable_status', [
  'draft',
  'submitted', // transient — fn_submit_deliverable_for_review transitions out of this
  'pending_director',
  'pending_am',
  'revisions_director',
  'revisions_am',
  'client_ready',
  'in_client_review',
  'revisions_client',
  'delivered',
  'cancelled',
]);

export const internalApprovalStageEnum = pgEnum('internal_approval_stage', [
  'director',
  'account_manager',
  'production_manager',
  'custom',
]);

export const internalApprovalStatusEnum = pgEnum('internal_approval_status', [
  'pending',
  'approved',
  'revisions_requested',
  'skipped',
  'auto_advanced',
]);

// ── briefs ───────────────────────────────────────────────────────────────────

export const briefs = pgTable(
  'briefs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(1),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().default(sql`now()`),
    receivedVia: text('received_via'), // 'email' | 'whatsapp' | 'meeting' | 'phone' | 'in_app'
    sourceEmailMessageId: text('source_email_message_id'),
    sourceText: text('source_text'),
    parsedSummary: text('parsed_summary'),
    parsedFields: jsonb('parsed_fields').notNull().default({}),

    parsedShootDate: timestamp('parsed_shoot_date', { withTimezone: true }),
    parsedDeliverablesCount: integer('parsed_deliverables_count'),
    parsedLanguages: text('parsed_languages').array(),
    parsedLocations: text('parsed_locations').array(),
    parsedVehicles: text('parsed_vehicles').array(),
    parsedBudgetSar: numeric('parsed_budget_sar', { precision: 12, scale: 2 }),

    completenessScore: integer('completeness_score'),
    missingFields: text('missing_fields').array(),

    createdBy: uuid('created_by').references(() => profiles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [unique('brief_per_version').on(t.projectId, t.version)],
);

// ── deliverable_groups ───────────────────────────────────────────────────────

export const deliverableGroups = pgTable('deliverable_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  kind: text('kind'), // 'reels' | 'photos' | 'print_photos' | 'video' | 'other'
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── deliverables (with Pillar 16 §N.2 approval-workflow columns) ─────────────

export const deliverables = pgTable('deliverables', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => deliverableGroups.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }), // denormalized for fast queries

  position: integer('position').notNull().default(0),
  itemNumber: text('item_number'),
  title: text('title'),
  status: deliverableStatusEnum('status').notNull().default('draft'),

  // Delivery
  currentVersionUrl: text('current_version_url'),
  currentVersionNumber: integer('current_version_number').notNull().default(0),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedById: uuid('approved_by_id').references(() => profiles.id),

  // Client feedback (denormalized latest)
  latestClientNote: text('latest_client_note'),
  latestClientNoteAt: timestamp('latest_client_note_at', { withTimezone: true }),

  // Internal approval flow (Pillar 16 §N.2)
  requiresDirectorApproval: boolean('requires_director_approval').notNull().default(true),
  requiresAmApproval: boolean('requires_am_approval').notNull().default(true),
  currentApprovalStage: text('current_approval_stage'), // 'creator' | 'director' | 'am' | 'client_ready' | 'approved'
  currentCycle: integer('current_cycle').notNull().default(1),

  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── revision_rounds + revision_items ─────────────────────────────────────────

export const revisionRounds = pgTable(
  'revision_rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().default(sql`now()`),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    initiatedById: uuid('initiated_by_id').references(() => profiles.id),
    summary: text('summary'),
    clientFeedback: text('client_feedback'),
    internalNotes: text('internal_notes'),
  },
  (t) => [unique('revision_round_unique').on(t.projectId, t.roundNumber)],
);

export const revisionItems = pgTable('revision_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  roundId: uuid('round_id')
    .notNull()
    .references(() => revisionRounds.id, { onDelete: 'cascade' }),
  deliverableId: uuid('deliverable_id').references(() => deliverables.id),
  itemNumber: text('item_number'),
  changeRequest: text('change_request'),
  status: text('status').notNull().default('open'), // 'open' | 'done' | 'cancelled'
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedById: uuid('resolved_by_id').references(() => profiles.id),
});

// ── internal_approvals (Pillar 16 §N.1) ──────────────────────────────────────

export const internalApprovals = pgTable(
  'internal_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    deliverableId: uuid('deliverable_id').references(() => deliverables.id, {
      onDelete: 'cascade',
    }),

    stage: internalApprovalStageEnum('stage').notNull(),
    stageOrder: integer('stage_order').notNull(),
    cycleNumber: integer('cycle_number').notNull().default(1),

    reviewerProfileId: uuid('reviewer_profile_id')
      .notNull()
      .references(() => profiles.id),

    status: internalApprovalStatusEnum('status').notNull().default('pending'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().default(sql`now()`),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

    versionReviewed: integer('version_reviewed'),
    notes: text('notes'),
    revisionRequestText: text('revision_request_text'),
    revisionRequestPriority: text('revision_request_priority'), // 'minor' | 'major' | 'blocking'

    slaHours: integer('sla_hours'),
    slaBreachedAt: timestamp('sla_breached_at', { withTimezone: true }),
    autoAdvancedById: uuid('auto_advanced_by_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('approvals_by_deliverable').on(t.deliverableId, t.cycleNumber, t.stageOrder),
  ],
);

export type Brief = typeof briefs.$inferSelect;
export type DeliverableGroup = typeof deliverableGroups.$inferSelect;
export type Deliverable = typeof deliverables.$inferSelect;
export type NewDeliverable = typeof deliverables.$inferInsert;
export type RevisionRound = typeof revisionRounds.$inferSelect;
export type RevisionItem = typeof revisionItems.$inferSelect;
export type InternalApproval = typeof internalApprovals.$inferSelect;
