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
  check,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles, freelancers, squads } from './people';
import { clients, contacts, locations } from './orgs';

// ── enums ───────────────────────────────────────────────────────────────────────

export const projectStageEnum = pgEnum('project_stage', [
  'lead',
  'brief',
  'quoted',
  'approved',
  'planning',
  'shooting',
  'editing',
  'review',
  'delivered',
  'archived',
  'lost',
  'cancelled',
]);

export const projectTypeEnum = pgEnum('project_type', [
  'shoot',
  'edit_only',
  'live_coverage',
  'content_creation',
  'consulting',
  'other',
]);

export const projectAssignmentRoleEnum = pgEnum('project_assignment_role', [
  'account_manager',
  'project_manager',
  'production_manager',
  'shooter_lead',
  'shooter',
  'editor_lead',
  'editor',
  'colorist',
  'sound_engineer',
  'drone_pilot',
  'talent',
  'stylist',
  'makeup',
  'art_director',
  'production_assistant',
  'freelancer_other',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

// ── projects (the spine) ───────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(), // PRJ-NNNN auto via sequence
  title: text('title').notNull(),
  titleAr: text('title_ar'),
  description: text('description'),

  projectType: projectTypeEnum('project_type').notNull(),
  stage: projectStageEnum('stage').notNull().default('brief'),

  // Relationships
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),
  agencyId: uuid('agency_id').references(() => clients.id),
  agencyContactId: uuid('agency_contact_id').references(() => contacts.id),
  primaryContactId: uuid('primary_contact_id').references(() => contacts.id),

  accountManagerId: uuid('account_manager_id').references(() => profiles.id),
  projectManagerId: uuid('project_manager_id').references(() => profiles.id),
  productionManagerId: uuid('production_manager_id').references(() => profiles.id),

  locationId: uuid('location_id').references(() => locations.id),

  // Dates
  briefReceivedAt: timestamp('brief_received_at', { withTimezone: true }),
  quotedAt: timestamp('quoted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  shootStartsAt: timestamp('shoot_starts_at', { withTimezone: true }),
  shootEndsAt: timestamp('shoot_ends_at', { withTimezone: true }),
  deliveryDueAt: timestamp('delivery_due_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  lostReason: text('lost_reason'),
  postMortemNotes: text('post_mortem_notes'),

  contractedValueSar: numeric('contracted_value_sar', { precision: 12, scale: 2 }),

  // Abu Luka personal content (Pillar permissions Part 5) — crew may see the
  // project EXISTS but client/agency/value are hidden + UI shows a generic
  // "محتوى أبو لوكا" label instead of the client name.
  isAbuLukaContent: boolean('is_abu_luka_content').notNull().default(false),

  // AI-derived
  aiStatusParagraph: text('ai_status_paragraph'),
  aiRiskLevel: text('ai_risk_level'), // 'green' | 'amber' | 'red'
  aiNextAction: text('ai_next_action'),
  aiAnalyzedAt: timestamp('ai_analyzed_at', { withTimezone: true }),

  // External integrations
  driveFolderUrl: text('drive_folder_url'),
  driveFolderId: text('drive_folder_id'),
  calendarEventId: text('calendar_event_id'),

  // Dafterah references (D-022 — invoicing lives in Dafterah, we store refs only)
  dafterahQuoteNumber: text('dafterah_quote_number'),
  dafterahInvoiceNumber: text('dafterah_invoice_number'),
  dafterahPoNumber: text('dafterah_po_number'),

  // Approval flow config (Pillar 16 §N.7 — overrides default at project level)
  defaultApprovalFlow: jsonb('default_approval_flow').notNull().default({
    director_required: true,
    am_required: true,
    director_sla_hours: 24,
    am_sla_hours: 24,
    auto_advance_on_sla_breach: false,
  }),

  // Recurrence
  recurrenceRule: text('recurrence_rule'),
  recurrenceParentId: uuid('recurrence_parent_id'),
  nextOccurrenceAt: timestamp('next_occurrence_at', { withTimezone: true }),

  customFields: jsonb('custom_fields').notNull().default({}),
  notes: text('notes'),

  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── project_stages_log ────────────────────────────────────────────────────────

export const projectStagesLog = pgTable('project_stages_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  fromStage: projectStageEnum('from_stage'),
  toStage: projectStageEnum('to_stage').notNull(),
  changedBy: uuid('changed_by').references(() => profiles.id),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().default(sql`now()`),
  durationInPrevSeconds: integer('duration_in_prev_seconds'),
  reason: text('reason'),
  metadata: jsonb('metadata').default({}),
});

// ── project_assignments ──────────────────────────────────────────────────────

export const projectAssignments = pgTable(
  'project_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Exactly one of (profileId, freelancerId, externalName) — enforced via CHECK
    profileId: uuid('profile_id').references(() => profiles.id),
    freelancerId: uuid('freelancer_id').references(() => freelancers.id),
    externalName: text('external_name'),
    externalContactInfo: text('external_contact_info'),

    role: projectAssignmentRoleEnum('role').notNull(),

    rateSar: numeric('rate_sar', { precision: 10, scale: 2 }),
    rateUnit: text('rate_unit'), // 'per_day' | 'per_project' | 'per_hour'

    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().default(sql`now()`),
    startDate: text('start_date'),
    endDate: text('end_date'),

    notes: text('notes'),
    createdBy: uuid('created_by').references(() => profiles.id),
  },
  (t) => [
    check(
      'assignment_who_exclusive',
      sql`(${t.profileId} IS NOT NULL)::int + (${t.freelancerId} IS NOT NULL)::int + (${t.externalName} IS NOT NULL)::int = 1`,
    ),
  ],
);

// ── project_contacts (M:N) ───────────────────────────────────────────────────

export const projectContacts = pgTable(
  'project_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id),
    side: text('side').notNull(), // 'brand' | 'agency' | 'vendor' | 'talent'
    roleLabel: text('role_label'),
    isPrimary: boolean('is_primary').notNull().default(false),
    notes: text('notes'),
  },
  (t) => [unique('project_contact_unique').on(t.projectId, t.contactId)],
);

// ── project_squad_assignments (M:N) ──────────────────────────────────────────

export const projectSquadAssignments = pgTable(
  'project_squad_assignments',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    squadId: uuid('squad_id')
      .notNull()
      .references(() => squads.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.squadId] })],
);

// ── project_tasks + daily_tasks ──────────────────────────────────────────────

export const projectTasks = pgTable('project_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  parentTaskId: uuid('parent_task_id'),

  title: text('title').notNull(),
  description: text('description'),

  assigneeId: uuid('assignee_id').references(() => profiles.id),
  status: taskStatusEnum('status').notNull().default('pending'),
  priority: taskPriorityEnum('priority').notNull().default('normal'),

  dueAt: timestamp('due_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  dependsOn: uuid('depends_on').array(),
  position: integer('position').notNull().default(0),

  aiSuggested: boolean('ai_suggested').notNull().default(false),

  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const dailyTasks = pgTable('daily_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  assignerId: uuid('assigner_id').references(() => profiles.id),

  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('pending'),
  priority: taskPriorityEnum('priority').notNull().default('normal'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Idempotency tag for system-generated rows (migration 055). The per-position
  // My Day routine materializes one row per item per day keyed by
  // source_key = 'routine:<item_key>:<YYYY-MM-DD>'. Null for hand-created tasks.
  sourceKey: text('source_key'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── project_comments ─────────────────────────────────────────────────────────

export const projectComments = pgTable('project_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  parentCommentId: uuid('parent_comment_id'),
  authorId: uuid('author_id')
    .notNull()
    .references(() => profiles.id),
  body: text('body').notNull(),
  mentionedProfileIds: uuid('mentioned_profile_ids').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ── project_pins (polymorphic) ───────────────────────────────────────────────

export const projectPins = pgTable('project_pins', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  pinnedType: text('pinned_type').notNull(), // 'deliverable' | 'email_thread' | 'file' | 'note' | 'contact'
  pinnedId: text('pinned_id'),
  label: text('label'),
  body: text('body'),
  position: integer('position').notNull().default(0),
  pinnedBy: uuid('pinned_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── project_templates ────────────────────────────────────────────────────────

export const projectTemplates = pgTable('project_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  description: text('description'),
  payload: jsonb('payload').notNull().default({}),
  useCount: integer('use_count').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectAssignment = typeof projectAssignments.$inferSelect;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type ProjectComment = typeof projectComments.$inferSelect;
