/**
 * Pillar 5 §3 — Project lifecycle additions on top of Pillars 2/4.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';
import { projects, projectStageEnum, projectAssignmentRoleEnum } from './projects';

// ── stage_task_templates ──────────────────────────────────────────────────────

export const stageTaskTemplates = pgTable('stage_task_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  stage: projectStageEnum('stage').notNull(),
  titleAr: text('title_ar').notNull(),
  titleEn: text('title_en'),
  description: text('description'),
  assigneeRoleHint: projectAssignmentRoleEnum('assignee_role_hint'),
  dueOffsetDays: integer('due_offset_days'),
  isMandatory: boolean('is_mandatory').notNull().default(false),
  position: integer('position').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

// ── project_recurrence_rules ──────────────────────────────────────────────────

export const projectRecurrenceRules = pgTable('project_recurrence_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateProjectId: uuid('template_project_id')
    .notNull()
    .references(() => projects.id),
  rrule: text('rrule').notNull(), // RRULE string per RFC 5545
  nextOccurrenceAt: timestamp('next_occurrence_at', { withTimezone: true }),
  lastSpawnedAt: timestamp('last_spawned_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
});

// ── project_share_views (replaces the single share_token from Pillar 2) ──────

export const projectShareViews = pgTable('project_share_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  shareToken: uuid('share_token').notNull().unique().defaultRandom(),
  audienceLabel: text('audience_label'),
  showSections: text('show_sections')
    .array()
    .notNull()
    .default(sql`ARRAY['overview','deliverables']::text[]`),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type StageTaskTemplate = typeof stageTaskTemplates.$inferSelect;
export type ProjectRecurrenceRule = typeof projectRecurrenceRules.$inferSelect;
export type ProjectShareView = typeof projectShareViews.$inferSelect;
