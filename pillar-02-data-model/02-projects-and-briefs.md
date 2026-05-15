# Pillar 2 — Projects & Briefs

> Part of **Pillar 2 (Data Model)** — see [`../pillar-02-data-model.md`](../pillar-02-data-model.md) for overview + index.
> Sections: **§5 PROJECTS**, **§6 BRIEFS / DELIVERABLES / REVISIONS**.

---

## 5. PROJECTS — The Core of Antagna

This is the most important domain. Every action on the system ultimately ties back to a project (or to a client → projects).

### 5.1 `projects` — the spine

```typescript
// packages/db/src/schema/projects.ts
export const projectStageEnum = pgEnum("project_stage", [
  "lead",          // not yet a project, but tracking
  "brief",         // brief received
  "quoted",        // quotation sent
  "approved",      // client said yes
  "planning",      // crew/equipment/location prep
  "shooting",
  "editing",
  "review",        // client reviewing deliverables
  "delivered",
  "archived",
  "lost",
  "cancelled"
]);

export const projectTypeEnum = pgEnum("project_type", [
  "shoot",          // photo / video / mixed
  "edit_only",
  "live_coverage",
  "content_creation",
  "consulting",
  "other"
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Identifier
  code: text("code").notNull().unique(),                    // PRJ-0001, PRJ-0002 (auto-generated)
  title: text("title").notNull(),                            // human-readable
  titleAr: text("title_ar"),
  description: text("description"),

  // Classification
  projectType: projectTypeEnum("project_type").notNull(),
  stage: projectStageEnum("stage").notNull().default("brief"),

  // Relationships
  clientId: uuid("client_id").notNull().references(() => clients.id),
  // For agency-in-the-middle deals:
  agencyId: uuid("agency_id").references(() => clients.id),
  agencyContactId: uuid("agency_contact_id").references(() => contacts.id),
  primaryContactId: uuid("primary_contact_id").references(() => contacts.id),

  // Volt internal owners
  accountManagerId: uuid("account_manager_id").references(() => profiles.id),
  projectManagerId: uuid("project_manager_id").references(() => profiles.id),
  productionManagerId: uuid("production_manager_id").references(() => profiles.id),

  // Dates
  briefReceivedAt: timestamp("brief_received_at", { withTimezone: true }),
  quotedAt: timestamp("quoted_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  shootStartsAt: timestamp("shoot_starts_at", { withTimezone: true }),
  shootEndsAt: timestamp("shoot_ends_at", { withTimezone: true }),
  deliveryDueAt: timestamp("delivery_due_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  // Outcome
  lostReason: text("lost_reason"),
  postMortemNotes: text("post_mortem_notes"),

  // Commercials (denormalized for quick access; source of truth is quotes/invoices in Pillar 5+)
  contractedValueSar: numeric("contracted_value_sar", { precision: 12, scale: 2 }),

  // AI-derived (cached, invalidated by triggers in Pillar 10)
  aiStatusParagraph: text("ai_status_paragraph"),
  aiRiskLevel: text("ai_risk_level"),                       // 'green' | 'amber' | 'red'
  aiNextAction: text("ai_next_action"),
  aiAnalyzedAt: timestamp("ai_analyzed_at", { withTimezone: true }),

  // External links
  driveFolderUrl: text("drive_folder_url"),
  driveFolderId: text("drive_folder_id"),
  calendarEventId: text("calendar_event_id"),

  // Shareability — see project_share_views in Pillar 5 §3.3 for the
  // multi-link model. Pillar 2 does NOT add a share_token column on projects;
  // all share links live in project_share_views with their own audience scope.

  // Recurrence (e.g., monthly retainer)
  recurrenceRule: text("recurrence_rule"),                  // RRULE format
  recurrenceParentId: uuid("recurrence_parent_id"),
  nextOccurrenceAt: timestamp("next_occurrence_at", { withTimezone: true }),

  // Free-form
  customFields: jsonb("custom_fields").notNull().default({}),
  notes: text("notes"),

  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 5.2 `project_stages_log` (audit-like timeline per project)

```typescript
export const projectStagesLog = pgTable("project_stages_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fromStage: projectStageEnum("from_stage"),
  toStage: projectStageEnum("to_stage").notNull(),
  changedBy: uuid("changed_by").references(() => profiles.id),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  durationInPrevSeconds: integer("duration_in_prev_seconds"),  // computed on transition
  reason: text("reason"),
  metadata: jsonb("metadata").default({}),
});
```

Filled by trigger `tg_log_project_stage`: AFTER UPDATE on `projects` when `stage` changes.

### 5.3 `project_assignments` (who's on this project, in what role)

```typescript
export const projectAssignmentRoleEnum = pgEnum("project_assignment_role", [
  "account_manager", "project_manager", "production_manager",
  "shooter_lead", "shooter", "editor_lead", "editor",
  "colorist", "sound_engineer", "drone_pilot", "talent",
  "stylist", "makeup", "art_director", "production_assistant",
  "freelancer_other"
]);

export const projectAssignments = pgTable("project_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),

  // Either internal profile OR named external freelancer (not both required, but ≥1)
  profileId: uuid("profile_id").references(() => profiles.id),
  externalName: text("external_name"),
  externalContactInfo: text("external_contact_info"),

  role: projectAssignmentRoleEnum("role").notNull(),

  // Pay (for budget tracking; finance module computes from this in Pillar 5+)
  rateSar: numeric("rate_sar", { precision: 10, scale: 2 }),
  rateUnit: text("rate_unit"),                              // 'per_day', 'per_project', 'per_hour'

  // Time
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  startDate: text("start_date"),
  endDate: text("end_date"),

  notes: text("notes"),
  createdBy: uuid("created_by").references(() => profiles.id),
}, (t) => ({
  // At least one of (profileId, externalName) must be set
  whoCheck: check("assignment_who", sql`${t.profileId} IS NOT NULL OR ${t.externalName} IS NOT NULL`),
}));
```

### 5.4 `project_contacts` (M2M between project and contacts, with role labels)

```typescript
export const projectContacts = pgTable("project_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  side: text("side").notNull(),                              // 'brand', 'agency', 'vendor', 'talent'
  roleLabel: text("role_label"),                             // free-form: "Marketing Manager", etc.
  isPrimary: boolean("is_primary").notNull().default(false),
  notes: text("notes"),
}, (t) => ({
  uniqueLink: unique().on(t.projectId, t.contactId),
}));
```

### 5.5 `project_tasks` (project-scoped tasks)

```typescript
export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "blocked", "completed", "cancelled"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "normal", "high", "urgent"]);

export const projectTasks = pgTable("project_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentTaskId: uuid("parent_task_id"),                     // subtasks

  title: text("title").notNull(),
  description: text("description"),

  assigneeId: uuid("assignee_id").references(() => profiles.id),
  status: taskStatusEnum("status").notNull().default("pending"),
  priority: taskPriorityEnum("priority").notNull().default("normal"),

  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  dependsOn: uuid("depends_on").array(),                     // array of task IDs
  position: integer("position").notNull().default(0),

  aiSuggested: boolean("ai_suggested").notNull().default(false),

  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Also create `daily_tasks` (no project, personal) with similar shape — included here since the pattern is identical:

```typescript
export const dailyTasks = pgTable("daily_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  assignerId: uuid("assigner_id").references(() => profiles.id),

  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("pending"),
  priority: taskPriorityEnum("priority").notNull().default("normal"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 5.6 `project_comments` (threaded, with mentions)

```typescript
export const projectComments = pgTable("project_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentCommentId: uuid("parent_comment_id"),
  authorId: uuid("author_id").notNull().references(() => profiles.id),
  body: text("body").notNull(),
  mentionedProfileIds: uuid("mentioned_profile_ids").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
```

### 5.7 `project_pins` (sticky items in the project header)

Polymorphic — can pin a deliverable, a thread, a file, a note.

```typescript
export const projectPins = pgTable("project_pins", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  pinnedType: text("pinned_type").notNull(),                // 'deliverable', 'email_thread', 'file', 'note', 'contact'
  pinnedId: text("pinned_id"),                              // text to support multiple PK types
  label: text("label"),
  body: text("body"),
  position: integer("position").notNull().default(0),
  pinnedBy: uuid("pinned_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 5.8 `project_templates` (canonical playbooks)

```typescript
export const projectTemplates = pgTable("project_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                    // 'STD_SHOOT_1DAY', 'EVENT_COVERAGE', ...
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  description: text("description"),

  // The canonical playbook (in jsonb so we can iterate without migrations)
  // Structure: { stages: [...], default_tasks: [...], default_deliverables: [...], default_assignments: [...] }
  payload: jsonb("payload").notNull().default({}),

  useCount: integer("use_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 5.9 Triggers & Functions for Projects

```sql
-- 1. Auto-generate project code
CREATE SEQUENCE IF NOT EXISTS project_code_seq START WITH 1;
CREATE OR REPLACE FUNCTION fn_next_project_code() RETURNS text LANGUAGE sql AS $$
  SELECT 'PRJ-' || LPAD(nextval('project_code_seq')::text, 4, '0');
$$;
ALTER TABLE projects ALTER COLUMN code SET DEFAULT fn_next_project_code();

-- 2. Log stage transitions
CREATE OR REPLACE FUNCTION fn_log_project_stage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  prev_change_at timestamptz;
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    SELECT changed_at INTO prev_change_at
    FROM project_stages_log
    WHERE project_id = NEW.id
    ORDER BY changed_at DESC LIMIT 1;

    INSERT INTO project_stages_log (project_id, from_stage, to_stage, changed_by, duration_in_prev_seconds)
    VALUES (
      NEW.id, OLD.stage, NEW.stage, auth.uid(),
      CASE WHEN prev_change_at IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM (now() - prev_change_at))::int END
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_log_project_stage AFTER UPDATE OF stage ON projects
FOR EACH ROW EXECUTE FUNCTION fn_log_project_stage();

-- 3. Invalidate AI status on important changes (Pillar 10 will use this)
CREATE OR REPLACE FUNCTION fn_invalidate_project_ai_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE projects SET ai_analyzed_at = NULL WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN NULL;
END $$;

-- Attach to project_tasks, project_assignments, deliverables (later) on any change.

-- 4. Rotate share token (admin-only, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION fn_rotate_project_share_token(project_id_in uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_token uuid;
BEGIN
  IF NOT is_admin_caller() AND NOT can_manage_business() THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  new_token := gen_random_uuid();
  UPDATE projects SET share_token = new_token WHERE id = project_id_in;
  RETURN new_token;
END $$;
```

### 5.10 RLS for Projects domain

- Read: any authenticated user.
- Write/delete: account manager OR project manager OR production manager OR admin.
- `share_token` controlled by SECURITY DEFINER public read function (Pillar 8 wires this up).

---

## 6. BRIEFS, DELIVERABLES, REVISIONS

### 6.1 `briefs`

A project can have multiple briefs (different versions over time). Briefs are not edited in-place; new version creates a new row.

```typescript
export const briefs = pgTable("briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  receivedVia: text("received_via"),                        // 'email', 'whatsapp', 'meeting', 'phone', 'in_app'
  sourceEmailMessageId: text("source_email_message_id"),
  sourceText: text("source_text"),                          // original text (email body, WA message, etc.)
  parsedSummary: text("parsed_summary"),                    // AI-extracted summary
  parsedFields: jsonb("parsed_fields").notNull().default({}),
  // Extracted scalar columns for fast filtering (also in parsedFields jsonb for completeness):
  parsedShootDate: timestamp("parsed_shoot_date", { withTimezone: true }),
  parsedDeliverablesCount: integer("parsed_deliverables_count"),
  parsedLanguages: text("parsed_languages").array(),
  parsedLocations: text("parsed_locations").array(),
  parsedVehicles: text("parsed_vehicles").array(),
  parsedBudgetSar: numeric("parsed_budget_sar", { precision: 12, scale: 2 }),
  /* parsedFields example:
    {
      "deliverables": [{ "type": "reel", "count": 3 }, ...],
      "locations": [{ "city": "Jeddah", "site": "Hara BMW" }],
      "shoot_dates": ["2026-05-20"],
      "budget_sar": 25000,
      "languages": ["ar"],
      "vehicles": ["Ford Taurus 2026"],
      "talent": ["Hani Daghestani"],
      "usage_rights": "social_only"
    }
  */
  completenessScore: integer("completeness_score"),         // 0-100 (AI: how complete is this brief?)
  missingFields: text("missing_fields").array(),            // ['budget', 'usage_rights', ...]

  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePerVersion: unique().on(t.projectId, t.version),
}));
```

### 6.2 `deliverable_groups` and `deliverables`

Volt's existing pattern (the Hara_BMW spreadsheet): groups (Reels, Photos, Print Photos), each with line items.

```typescript
export const deliverableStatusEnum = pgEnum("deliverable_status", [
  "pending",          // not yet started
  "in_progress",
  "submitted",        // sent to client
  "in_review",        // client is reviewing
  "approved",
  "needs_revision",
  "delivered",        // final
  "cancelled"
]);

export const deliverableGroups = pgTable("deliverable_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  kind: text("kind"),                                       // 'reels', 'photos', 'print_photos', 'video', 'other'
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliverables = pgTable("deliverables", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => deliverableGroups.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), // denormalized for fast queries

  position: integer("position").notNull().default(0),
  itemNumber: text("item_number"),                          // "1", "DSC00057-HDR"
  title: text("title"),
  status: deliverableStatusEnum("status").notNull().default("pending"),

  // Delivery
  currentVersionUrl: text("current_version_url"),
  currentVersionNumber: integer("current_version_number").notNull().default(0),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedById: uuid("approved_by_id").references(() => profiles.id),

  // Client feedback (denormalized latest)
  latestClientNote: text("latest_client_note"),
  latestClientNoteAt: timestamp("latest_client_note_at", { withTimezone: true }),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 6.3 `revision_rounds` and `revision_items`

```typescript
export const revisionRounds = pgTable("revision_rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  initiatedById: uuid("initiated_by_id").references(() => profiles.id),
  summary: text("summary"),
  clientFeedback: text("client_feedback"),
  internalNotes: text("internal_notes"),
}, (t) => ({
  uniqueRound: unique().on(t.projectId, t.roundNumber),
}));

export const revisionItems = pgTable("revision_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull().references(() => revisionRounds.id, { onDelete: "cascade" }),
  deliverableId: uuid("deliverable_id").references(() => deliverables.id),
  itemNumber: text("item_number"),
  changeRequest: text("change_request"),
  status: text("status").notNull().default("open"),         // 'open' | 'done' | 'cancelled'
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedById: uuid("resolved_by_id").references(() => profiles.id),
});
```

### 6.4 Triggers

- `tg_bump_deliverable_version`: BEFORE UPDATE on `deliverables` — if `current_version_url` changed, increment `current_version_number` and set `submitted_at = now()`.
- `tg_check_project_auto_deliver`: AFTER UPDATE on `deliverables.status` — if all deliverables for the project are `delivered`, advance `projects.stage = 'delivered'`.
- `fn_next_revision_round(project_id_in)`: returns next round number.

### 6.5 RLS

- Read: any authenticated user.
- Write: project assignees + admins.

---

