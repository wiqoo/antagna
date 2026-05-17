/**
 * Pillar 10 — AI & Memory Layer additions.
 *
 * Pillar 1 already provides ai_usage, ai_user_limits, ai_memory_chunks.
 * Here we add the AI-loop output tables plus the learning loop tables from
 * Pillar 16 §E.
 */
import {
  pgTable,
  uuid,
  bigserial,
  bigint,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';
import { projects } from './projects';
import { emailTemplates, emailDrafts } from './comms';

// ── daily_briefs ─────────────────────────────────────────────────────────────

export const dailyBriefs = pgTable(
  'daily_briefs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id),
    briefDate: text('brief_date').notNull(), // YYYY-MM-DD
    content: text('content').notNull(),
    highlights: jsonb('highlights'),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().default(sql`now()`),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [unique('daily_brief_unique').on(t.profileId, t.briefDate)],
);

// ── project_insights (the "amber/red flag" surface) ──────────────────────────

export const projectInsights = pgTable('project_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  insightType: text('insight_type').notNull(),
  severity: text('severity').notNull(), // 'low' | 'medium' | 'high'
  titleAr: text('title_ar').notNull(),
  bodyAr: text('body_ar'),
  suggestedActions: jsonb('suggested_actions'),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  dismissedById: uuid('dismissed_by_id').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── ai_action_log (quality signal) ───────────────────────────────────────────

export const aiActionLog = pgTable('ai_action_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  aiUsageId: bigint('ai_usage_id', { mode: 'bigint' }),
  feature: text('feature').notNull(),
  outcome: text('outcome').notNull(), // 'accepted' | 'rejected' | 'edited' | 'ignored'
  userId: uuid('user_id').references(() => profiles.id),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── project_learnings (Pillar 16 §E.1) ───────────────────────────────────────

export const projectLearnings = pgTable('project_learnings', {
  id: uuid('id').primaryKey().defaultRandom(),
  scope: text('scope').notNull(), // 'client' | 'location' | 'talent' | 'crew' | 'general'
  scopeId: uuid('scope_id'),
  learningType: text('learning_type').notNull(),

  insightAr: text('insight_ar').notNull(),
  insightEn: text('insight_en'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(),
  sampleSize: integer('sample_size').notNull(),

  derivedFromProjectIds: uuid('derived_from_project_ids').array(),
  derivedFromActivityEventIds: bigint('derived_from_activity_event_ids', { mode: 'bigint' }).array(),

  validatedById: uuid('validated_by_id').references(() => profiles.id),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedReason: text('rejected_reason'),

  active: boolean('active').notNull().default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  supersededByLearningId: uuid('superseded_by_learning_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── decision_outcomes (Pillar 16 §E.2) ───────────────────────────────────────

export const decisionOutcomes = pgTable('decision_outcomes', {
  id: uuid('id').primaryKey().defaultRandom(),
  decisionType: text('decision_type').notNull(),
  decisionMadeAt: timestamp('decision_made_at', { withTimezone: true }).notNull(),
  decisionBy: text('decision_by').notNull(),
  aiUsageId: bigint('ai_usage_id', { mode: 'bigint' }),
  decisionInput: jsonb('decision_input'),
  decisionOutput: jsonb('decision_output'),

  outcomeMeasuredAt: timestamp('outcome_measured_at', { withTimezone: true }),
  outcomeLabel: text('outcome_label'),
  outcomeDetail: jsonb('outcome_detail'),
  outcomeFollowupBy: timestamp('outcome_followup_by', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── template_edit_patterns (Pillar 16 §E.4) ──────────────────────────────────

export const templateEditPatterns = pgTable('template_edit_patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateKey: text('template_key')
    .notNull()
    .references(() => emailTemplates.key),
  emailDraftId: uuid('email_draft_id').references(() => emailDrafts.id),
  editorProfileId: uuid('editor_profile_id').references(() => profiles.id),
  fieldEdited: text('field_edited'),
  originalText: text('original_text'),
  editedText: text('edited_text'),
  editDiff: jsonb('edit_diff'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── state_transition_overrides (Pillar 16 §E.5) ──────────────────────────────

export const stateTransitionOverrides = pgTable('state_transition_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  fromState: text('from_state'),
  toState: text('to_state').notNull(),
  byProfileId: uuid('by_profile_id').references(() => profiles.id),
  reason: text('reason'),
  illegalTransition: boolean('illegal_transition').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type DailyBrief = typeof dailyBriefs.$inferSelect;
export type ProjectInsight = typeof projectInsights.$inferSelect;
export type AiActionLog = typeof aiActionLog.$inferSelect;
export type ProjectLearning = typeof projectLearnings.$inferSelect;
export type DecisionOutcome = typeof decisionOutcomes.$inferSelect;
export type TemplateEditPattern = typeof templateEditPatterns.$inferSelect;
export type StateTransitionOverride = typeof stateTransitionOverrides.$inferSelect;
