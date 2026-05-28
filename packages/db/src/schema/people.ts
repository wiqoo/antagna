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
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── enums ───────────────────────────────────────────────────────────────────────

export const personStatusEnum = pgEnum('person_status', [
  'active',
  'inactive',
  'on_leave',
  'terminated',
]);

export const talentContractTypeEnum = pgEnum('talent_contract_type', [
  'exclusive',
  'non_exclusive',
  'project_based',
  'ad_hoc',
  'unsigned_potential',
]);

// ── profiles (extends Pillar 1 minimal version) ────────────────────────────────

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: uuid('auth_user_id').unique(),
  email: text('email').notNull().unique(),

  // Display + legal names (Abu Luka case: displayName=أبو لوكا, legalName=محمد المالكي).
  displayName: text('display_name').notNull(),
  displayNameEn: text('display_name_en'),
  legalName: text('legal_name'),

  // System role (project roles live on project_assignments).
  // NOTE: `role` is legacy (drives landing surface + ADMIN_ROLES gate). The
  // permission graph resolves via `positionKey` + user_position_overrides as of
  // Sprint 0 (D-037/D-041). `role` will be retired in Phase G.
  role: text('role').notNull().default('user'),
  // Primary position (D-037). Multi-hat extras live in userPositionOverrides.
  positionKey: text('position_key'),
  status: personStatusEnum('status').notNull().default('active'),

  // Acting-on-behalf (Mohammed approves for Abu Luka before his account exists).
  actingForId: uuid('acting_for_id'),

  // Personal
  phoneE164: text('phone_e164'),
  whatsappE164: text('whatsapp_e164'),
  avatarUrl: text('avatar_url'),

  // Workspace
  departmentId: uuid('department_id'),
  reportsToId: uuid('reports_to_id'),

  // Preferences
  uiLanguage: text('ui_language').notNull().default('ar'),
  timezone: text('timezone').notNull().default('Asia/Riyadh'),
  notificationPrefs: jsonb('notification_prefs').notNull().default({}),

  // Per-user onboarding state (Pillar 16 §H.4).
  // Shape: { status, steps_done?, completed_at?, skipped_at? }
  onboardingState: jsonb('onboarding_state')
    .notNull()
    .default({ status: 'pending', steps_done: [] }),

  // WhatsApp self-service linking — short-lived code the user sends from
  // their phone to the Volt line. The bot reads it, matches to this
  // profile, sets whatsapp_lid to the LID of the sender (for incoming
  // identification), and clears the code. whatsappE164 is set BEFORE
  // verification (the user types their real phone in /settings/whatsapp)
  // and is what the bot uses for OUTBOUND sends — WPPConnect can't
  // resolve LIDs to a sendable target.
  whatsappLid: text('whatsapp_lid'),
  whatsappVerificationCode: text('whatsapp_verification_code'),
  whatsappVerificationExpiresAt: timestamp('whatsapp_verification_expires_at', {
    withTimezone: true,
  }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

// ── employees (HR-side, 1:1 with profile) ──────────────────────────────────────

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),

  nationalId: text('national_id'),
  nationalIdType: text('national_id_type'), // 'saudi' | 'iqama' | 'visitor'
  nationality: text('nationality'),

  jobTitle: text('job_title'),
  hireDate: text('hire_date'), // YYYY-MM-DD
  endDate: text('end_date'),
  employmentType: text('employment_type'), // 'full_time' | 'part_time' | 'freelancer'

  monthlySalary: integer('monthly_salary'),
  monthlySalaryCurrency: text('monthly_salary_currency').default('SAR'),

  isFreelancer: boolean('is_freelancer').notNull().default(false),
  canBeShooter: boolean('can_be_shooter').notNull().default(false),
  canBeEditor: boolean('can_be_editor').notNull().default(false),
  canBePilot: boolean('can_be_pilot').notNull().default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type Employee = typeof employees.$inferSelect;

// ── skills catalog + user join (renamed from `capabilities` — D-038/D-041) ──────
//
// This is the production-skills catalog (shooter / editor / drone_pilot …).
// Renamed from `capabilities` in migration 048; the word "capabilities" is
// reclaimed for fine-grained access codes, which live in the `permissions`
// table (not here). The old empty `skills` (uuid id) stubs were dropped.

export const skills = pgTable('skills', {
  key: text('key').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  category: text('category'), // 'production' | 'post' | 'business' | 'admin'
  description: text('description'),
  iconKey: text('icon_key'),
  active: boolean('active').notNull().default(true),
  position: integer('position').notNull().default(0),
});

export const userSkills = pgTable(
  'user_skills',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    skillKey: text('skill_key')
      .notNull()
      .references(() => skills.key),
    isPrimary: boolean('is_primary').notNull().default(false),
    proficiency: integer('proficiency').notNull().default(2), // 1-5
    notes: text('notes'),
    addedBy: uuid('added_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.skillKey] })],
);

// ── positions (16-position model — D-037) ───────────────────────────────────────

export const positions = pgTable('positions', {
  key: text('key').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  description: text('description'),
  position: integer('position').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

// Multi-hat: extra positions beyond profiles.positionKey (Abu Luka GM+Creative,
// Mohammed Production+SysAdmin). has_permission() unions these in.
export const userPositionOverrides = pgTable(
  'user_position_overrides',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    positionKey: text('position_key')
      .notNull()
      .references(() => positions.key),
    isPrimary: boolean('is_primary').notNull().default(false),
    reason: text('reason'),
    grantedBy: uuid('granted_by').references(() => profiles.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.positionKey] })],
);

// ── departments + work calendar ────────────────────────────────────────────────

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  headProfileId: uuid('head_profile_id').references(() => profiles.id),
  position: integer('position').notNull().default(0),
});

export const workCalendarDefaults = pgTable('work_calendar_defaults', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  workingDays: text('working_days')
    .array()
    .notNull()
    .default(sql`ARRAY['sun','mon','tue','wed','thu']::text[]`),
  dayStartTime: text('day_start_time').notNull().default('09:00'),
  dayEndTime: text('day_end_time').notNull().default('18:00'),
  timezone: text('timezone').notNull().default('Asia/Riyadh'),
});

// ── squads (recurring teams; project_squad_assignments lives in projects.ts) ───

export const squads = pgTable('squads', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  purpose: text('purpose'), // 'crew' | 'editing_team' | 'content_calendar' | 'shooting_team'
  active: boolean('active').notNull().default(true),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const squadMembers = pgTable(
  'squad_members',
  {
    squadId: uuid('squad_id')
      .notNull()
      .references(() => squads.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id),
    defaultRole: text('default_role'),
    isCore: boolean('is_core').notNull().default(true),
    notes: text('notes'),
  },
  (t) => [primaryKey({ columns: [t.squadId, t.profileId] })],
);

// ── talents (Pillar 16 §D.2) ───────────────────────────────────────────────────

export const talents = pgTable('talents', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  displayName: text('display_name').notNull(),
  displayNameEn: text('display_name_en'),
  legalName: text('legal_name'),
  nationalIdLast4: text('national_id_last4'), // last 4 only — minimum PDPL exposure

  contractType: talentContractTypeEnum('contract_type').notNull().default('project_based'),
  commissionPct: numeric('commission_pct', { precision: 5, scale: 2 }),
  signedContractAt: text('signed_contract_at'),

  // FK to contacts (orgs.ts; FK added in migration to avoid circular import)
  primaryContactId: uuid('primary_contact_id'),
  phoneE164: text('phone_e164'),
  whatsappE164: text('whatsapp_e164'),

  category: text('category'), // 'auto_influencer' | 'lifestyle' | 'creator' | ...
  niches: text('niches').array(),
  languages: text('languages').array(),
  cityBase: text('city_base'),
  preferences: jsonb('preferences'),

  payoutMethodRef: text('payout_method_ref'),

  active: boolean('active').notNull().default(true),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── freelancers (Pillar 16 §D.3) ───────────────────────────────────────────────

export const freelancers = pgTable('freelancers', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  fullName: text('full_name').notNull(),
  fullNameAr: text('full_name_ar'),

  primaryContactId: uuid('primary_contact_id'),
  phoneE164: text('phone_e164'),
  emailPrimary: text('email_primary'),

  specialties: text('specialties').array(),
  cityBase: text('city_base'),

  defaultRateSar: numeric('default_rate_sar', { precision: 10, scale: 2 }),
  defaultRateUnit: text('default_rate_unit'), // 'per_day' | 'per_project'

  payoutMethodRef: text('payout_method_ref'),
  taxId: text('tax_id'),

  projectsCompleted: integer('projects_completed').notNull().default(0),
  averageRating: numeric('average_rating', { precision: 3, scale: 2 }),
  lastWorkedAt: timestamp('last_worked_at', { withTimezone: true }),
  preferred: boolean('preferred').notNull().default(false),

  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type Talent = typeof talents.$inferSelect;
export type Freelancer = typeof freelancers.$inferSelect;
