/**
 * Pillar 2 §9 — Cross-cutting tables.
 *
 * All of these are polymorphic (entity_type + entity_id pattern) and are
 * consumed by many feature pillars. Audit + RLS apply per-table.
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
  pgEnum,
  index,
  unique,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';
import { projects } from './projects';

// ── enums ──────────────────────────────────────────────────────────────────────

export const customFieldTypeEnum = pgEnum('custom_field_type', [
  'text',
  'long_text',
  'number',
  'currency',
  'date',
  'datetime',
  'boolean',
  'select',
  'multi_select',
  'url',
  'user_ref',
  'client_ref',
  'project_ref',
]);

export const externalLinkProviderEnum = pgEnum('external_link_provider', [
  'gdrive',
  'gcal',
  'gmail',
  'whatsapp',
  'youtube',
  'vimeo',
  'frameio',
  'instagram',
  'tiktok',
  'x',
  'other',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app',
  'email',
  'whatsapp',
  'push',
]);

// ── attachments (polymorphic) ──────────────────────────────────────────────────

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),

    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),

    storageProvider: text('storage_provider').notNull(), // 'supabase' | 'gdrive' | 'external_url'
    storagePath: text('storage_path'),
    externalUrl: text('external_url'),

    thumbnailUrl: text('thumbnail_url'),
    uploadedById: uuid('uploaded_by_id').references(() => profiles.id),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('attachments_entity_idx').on(t.entityType, t.entityId)],
);

// ── tags + tag_assignments (polymorphic) ──────────────────────────────────────

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  color: text('color'),
  category: text('category'),
  scopeEntityType: text('scope_entity_type'),
  active: boolean('active').notNull().default(true),
});

export const tagAssignments = pgTable(
  'tag_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    assignedById: uuid('assigned_by_id').references(() => profiles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    unique('tag_assignment_unique').on(t.tagId, t.entityType, t.entityId),
    index('tag_assignments_entity_idx').on(t.entityType, t.entityId),
  ],
);

// ── custom field definitions + values ─────────────────────────────────────────

export const customFieldDefinitions = pgTable(
  'custom_field_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    key: text('key').notNull(),
    labelAr: text('label_ar').notNull(),
    labelEn: text('label_en'),
    fieldType: customFieldTypeEnum('field_type').notNull(),
    options: jsonb('options').default({}),
    required: boolean('required').notNull().default(false),
    position: integer('position').notNull().default(0),
    active: boolean('active').notNull().default(true),
  },
  (t) => [unique('cf_def_unique').on(t.entityType, t.key)],
);

export const customFieldValues = pgTable(
  'custom_field_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => customFieldDefinitions.id),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    valueText: text('value_text'),
    valueNumber: numeric('value_number', { precision: 18, scale: 4 }),
    valueDate: text('value_date'),
    valueBoolean: boolean('value_boolean'),
    valueJson: jsonb('value_json'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [unique('cf_value_unique').on(t.definitionId, t.entityType, t.entityId)],
);

// ── external_links (polymorphic) ──────────────────────────────────────────────

export const externalLinks = pgTable(
  'external_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    provider: externalLinkProviderEnum('provider').notNull(),
    externalId: text('external_id'),
    url: text('url').notNull(),
    label: text('label'),
    metadata: jsonb('metadata').default({}),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('external_links_entity_idx').on(t.entityType, t.entityId),
    unique('external_link_unique').on(t.provider, t.externalId, t.entityType, t.entityId),
  ],
);

// ── notifications ─────────────────────────────────────────────────────────────

export const notificationEventTypes = pgTable('notification_event_types', {
  key: text('key').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  category: text('category'),
  defaultOn: boolean('default_on').notNull().default(true),
  defaultChannels: text('default_channels')
    .array()
    .notNull()
    .default(sql`ARRAY['in_app']::text[]`),
});

export const notifications = pgTable('notifications', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  recipientId: uuid('recipient_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  eventTypeKey: text('event_type_key').references(() => notificationEventTypes.key),

  entityType: text('entity_type'),
  entityId: uuid('entity_id'),

  title: text('title').notNull(),
  body: text('body'),
  linkUrl: text('link_url'),
  metadata: jsonb('metadata').default({}),

  channelsRequested: text('channels_requested').array().notNull(),
  channelsDelivered: text('channels_delivered')
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),

  readAt: timestamp('read_at', { withTimezone: true }),
  snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const notificationSubscriptions = pgTable(
  'notification_subscriptions',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    eventTypeKey: text('event_type_key')
      .notNull()
      .references(() => notificationEventTypes.key),
    channels: text('channels').array().notNull(),
    muted: boolean('muted').notNull().default(false),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.eventTypeKey] })],
);

// ── activity_events ───────────────────────────────────────────────────────────

export const activityEvents = pgTable(
  'activity_events',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    actorId: uuid('actor_id').references(() => profiles.id),
    // When Mohammed acts on behalf of Abu Luka, acted_as_id captures the principal.
    actedAsId: uuid('acted_as_id').references(() => profiles.id),

    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),

    projectId: uuid('project_id').references(() => projects.id),

    action: text('action').notNull(),
    summaryAr: text('summary_ar').notNull(),
    summaryEn: text('summary_en'),
    metadata: jsonb('metadata').default({}),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('activity_by_project').on(t.projectId, t.createdAt.desc()),
    index('activity_by_actor').on(t.actorId, t.createdAt.desc()),
    index('activity_by_entity').on(t.entityType, t.entityId),
  ],
);

export type Attachment = typeof attachments.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type TagAssignment = typeof tagAssignments.$inferSelect;
export type ExternalLink = typeof externalLinks.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ActivityEvent = typeof activityEvents.$inferSelect;
