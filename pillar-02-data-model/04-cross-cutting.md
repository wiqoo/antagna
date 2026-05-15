# Pillar 2 — Cross-Cutting Tables

> Part of **Pillar 2 (Data Model)** — see [`../pillar-02-data-model.md`](../pillar-02-data-model.md) for overview + index.
> Section: **§9 CROSS-CUTTING** (attachments, audit log, AI usage, comments, mentions, etc.).

---

## 9. CROSS-CUTTING TABLES

### 9.1 `attachments` (polymorphic)

```typescript
export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),               // 'project', 'brief', 'deliverable', 'invoice', 'contact', 'equipment', ...
  entityId: uuid("entity_id").notNull(),

  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: bigint("size_bytes").notNull(),

  // Storage location: either Supabase Storage or external (Drive)
  storageProvider: text("storage_provider").notNull(),     // 'supabase' | 'gdrive' | 'external_url'
  storagePath: text("storage_path"),                       // for supabase
  externalUrl: text("external_url"),                       // for Drive/external

  thumbnailUrl: text("thumbnail_url"),
  uploadedById: uuid("uploaded_by_id").references(() => profiles.id),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("attachments_entity_idx").on(t.entityType, t.entityId),
}));
```

### 9.2 `tags` and `tag_assignments` (polymorphic)

```typescript
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),                     // 'urgent', 'priority', 'archive', 'social_only'
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  color: text("color"),                                    // hex
  category: text("category"),
  scopeEntityType: text("scope_entity_type"),              // null = applies to anything; else restricts
  active: boolean("active").notNull().default(true),
});

export const tagAssignments = pgTable("tag_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tagId: uuid("tag_id").notNull().references(() => tags.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  assignedById: uuid("assigned_by_id").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueAssignment: unique().on(t.tagId, t.entityType, t.entityId),
  entityIdx: index("tag_assignments_entity_idx").on(t.entityType, t.entityId),
}));
```

### 9.3 `custom_field_definitions` and `custom_field_values`

```typescript
export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text", "long_text", "number", "currency", "date", "datetime", "boolean", "select", "multi_select", "url", "user_ref", "client_ref", "project_ref"
]);

export const customFieldDefinitions = pgTable("custom_field_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),               // 'project', 'client', 'contact', 'equipment'
  key: text("key").notNull(),                              // 'campaign_code'
  labelAr: text("label_ar").notNull(),
  labelEn: text("label_en"),
  fieldType: customFieldTypeEnum("field_type").notNull(),
  options: jsonb("options").default({}),                   // for select/multi_select: { choices: [...] }
  required: boolean("required").notNull().default(false),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
}, (t) => ({
  uniqueKey: unique().on(t.entityType, t.key),
}));

export const customFieldValues = pgTable("custom_field_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  definitionId: uuid("definition_id").notNull().references(() => customFieldDefinitions.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  valueText: text("value_text"),
  valueNumber: numeric("value_number", { precision: 18, scale: 4 }),
  valueDate: text("value_date"),
  valueBoolean: boolean("value_boolean"),
  valueJson: jsonb("value_json"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePerEntity: unique().on(t.definitionId, t.entityType, t.entityId),
}));
```

### 9.4 `external_links` (Drive folders, Calendar events, Gmail threads, WhatsApp threads etc.)

```typescript
export const externalLinkProviderEnum = pgEnum("external_link_provider", [
  "gdrive", "gcal", "gmail", "whatsapp", "youtube", "vimeo", "frameio", "instagram", "tiktok", "x", "other"
]);

export const externalLinks = pgTable("external_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  provider: externalLinkProviderEnum("provider").notNull(),
  externalId: text("external_id"),                         // provider-specific ID
  url: text("url").notNull(),
  label: text("label"),
  metadata: jsonb("metadata").default({}),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("external_links_entity_idx").on(t.entityType, t.entityId),
  uniqueExternal: unique().on(t.provider, t.externalId, t.entityType, t.entityId),
}));
```

### 9.5 `notifications`, `notification_event_types`, `notification_subscriptions`

```typescript
export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "email", "whatsapp", "push"]);

export const notificationEventTypes = pgTable("notification_event_types", {
  key: text("key").primaryKey(),                           // 'project.assigned', 'task.overdue', 'deliverable.submitted', ...
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  category: text("category"),
  defaultOn: boolean("default_on").notNull().default(true),
  defaultChannels: text("default_channels").array().notNull().default(sql`ARRAY['in_app']`),
});

export const notifications = pgTable("notifications", {
  id: bigserial("id").primaryKey(),
  recipientId: uuid("recipient_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  eventTypeKey: text("event_type_key").references(() => notificationEventTypes.key),

  // Polymorphic anchor
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),

  title: text("title").notNull(),
  body: text("body"),
  linkUrl: text("link_url"),
  metadata: jsonb("metadata").default({}),

  // Delivery
  channelsRequested: text("channels_requested").array().notNull(),
  channelsDelivered: text("channels_delivered").array().notNull().default(sql`ARRAY[]::text[]`),

  readAt: timestamp("read_at", { withTimezone: true }),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationSubscriptions = pgTable("notification_subscriptions", {
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  eventTypeKey: text("event_type_key").notNull().references(() => notificationEventTypes.key),
  channels: text("channels").array().notNull(),
  muted: boolean("muted").notNull().default(false),
  quietHoursStart: text("quiet_hours_start"),              // 'HH:MM'
  quietHoursEnd: text("quiet_hours_end"),
}, (t) => ({
  pk: primaryKey({ columns: [t.profileId, t.eventTypeKey] }),
}));
```

### 9.6 `activity_events` (the public feed; visible to all authenticated users)

```typescript
export const activityEvents = pgTable("activity_events", {
  id: bigserial("id").primaryKey(),
  actorId: uuid("actor_id").references(() => profiles.id),
  actedAsId: uuid("acted_as_id").references(() => profiles.id),  // when Mohammed acts for Abu Luka

  // Polymorphic
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),

  // Project context (denormalized for fast filtering)
  projectId: uuid("project_id").references(() => projects.id),

  action: text("action").notNull(),                        // 'created', 'updated', 'commented', 'assigned', 'completed', 'stage_changed'
  summaryAr: text("summary_ar").notNull(),
  summaryEn: text("summary_en"),
  metadata: jsonb("metadata").default({}),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byProject: index("activity_by_project").on(t.projectId, t.createdAt.desc()),
  byActor: index("activity_by_actor").on(t.actorId, t.createdAt.desc()),
}));
```

Same `acted_as_id` field is added to `audit_log` (extending Pillar 1's definition). When set, UI renders: `"محمد غريب → أبو لوكا: [action]"`.

### 9.7 RLS for cross-cutting

- `attachments`, `tag_assignments`, `external_links`, `activity_events`: read = authenticated; write = entity-scoped (e.g., can edit attachments on a project you're assigned to).
- `notifications`: read = self only; write = trigger functions (SECURITY DEFINER) only.
- `tag_assignments`: read = authenticated; write = anyone authenticated (cheap).
- `tags`, `custom_field_definitions`, `notification_event_types`: read = all; write = admin.

---

