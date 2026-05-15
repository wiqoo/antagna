# Pillar 2 — Data Model (Core Backbone)

**Status:** In progress
**Depends on:** Pillar 1 complete
**Estimated effort:** 2-3 Claude Code sessions on Ubuntu

This pillar defines the **canonical backbone** Antagna runs on: who exists, who they work with, what they make, and what equipment makes it. Feature-specific tables (compatibility rules, attendance records, social-media posts, etc.) belong in their respective feature pillars; here we lock the spine.

If you find yourself wanting to add a table here that belongs to a feature, push it to that feature's pillar. **Pillar 2 is the smallest model that lets every feature pillar fit on top.**

---

## 1. Goals & Success Criteria

### Goals
- A normalized, RLS-locked, audit-instrumented schema covering: people, orgs, projects, equipment, plus the cross-cutting tables (attachments, tags, notifications, activity, external links).
- State machines defined and enforced in SQL for projects + deliverables + revisions.
- The multi-hat people model: one person → many capabilities → many roles in a project.
- The organization model: a single `clients` table with `is_agency` flag, agency↔brand many-to-many.
- The project model: one client (the end brand), optionally one agency in between, many internal assignments, many deliverables, many revisions.
- Drizzle ORM schemas in `packages/db/src/schema/*.ts` matching every SQL table.
- Trigger functions for: updated_at, audit, state-transition rules, derived counters.

### Success Criteria — Pillar 2 is DONE when:
1. ✅ All Pillar 2 tables created in staging Supabase with RLS enabled.
2. ✅ All triggers compile and fire on test inserts/updates.
3. ✅ Drizzle types match SQL (no drift). `pnpm db:gen` produces clean output.
4. ✅ Each domain has at least 3 test rows inserted via a seed script — and the queries below all return expected results.
5. ✅ Audit log records every insert/update/delete across all Pillar 2 tables.
6. ✅ A project can be created with a client, brand, agency, primary contact, account manager, project manager, and a brief — in one transaction, with all FK constraints satisfied.
7. ✅ A deliverable can transition through its state machine (`pending → in_progress → submitted → approved → delivered`) and audit log captures each transition.
8. ✅ An equipment item can be reserved for a project, and an overlapping reservation is rejected by the exclusion constraint.
9. ✅ The selective migration script from old Supabase populates ≥ 162 equipment rows + ≥ 20 client rows into the new schema with no FK violations.
10. ✅ `pnpm type-check` passes across `packages/db` consumers (`apps/web`, `apps/worker`, `packages/ai`).

---

## 2. The Entity Map

### Domain → Tables overview

```
PEOPLE                      ORGANIZATIONS              PROJECTS
├─ profiles                 ├─ clients                 ├─ projects
├─ employees                │   (is_agency flag)       ├─ project_stages_log
├─ capabilities             ├─ agency_brand_links      ├─ project_assignments
├─ user_capabilities        ├─ contacts                ├─ project_contacts
├─ skills                   └─ contact_methods         ├─ project_tasks
├─ user_skills                                         ├─ project_comments
├─ departments                                         ├─ project_pins
└─ work_calendar_defaults                              ├─ project_templates
                                                       │
DELIVERABLES & REVISIONS    MONEY (schema, deferred)   EQUIPMENT
├─ briefs                   ├─ quotes                  ├─ equipment
├─ brief_fields             ├─ quote_line_items        ├─ kits
├─ deliverable_groups       ├─ invoices                ├─ kit_items
├─ deliverables             ├─ invoice_line_items      ├─ equipment_reservations
├─ revision_rounds          ├─ payments                ├─ equipment_activity_log
└─ revision_items           └─ payment_terms_catalog   └─ equipment_groups

CROSS-CUTTING                                          SYSTEM (from Pillar 1)
├─ attachments (polymorphic)                           ├─ profiles (auth-linked)
├─ tags                                                ├─ audit_log
├─ tag_assignments (polymorphic)                       ├─ ai_usage
├─ custom_field_definitions                            ├─ ai_user_limits
├─ custom_field_values (polymorphic)                   ├─ ai_memory_chunks
├─ external_links (polymorphic)                        └─ system_settings
├─ notifications
├─ notification_event_types
├─ activity_events
└─ activity_subscriptions
```

### Relationships at a glance

```
Person 1 ──< user_capabilities >── M Capability        (multi-hat)
Person 1 ──< user_skills        >── M Skill           (graded skill catalog)
Person M ──── Department  (optional)
Person 1 ──< project_assignments >── M Project        (with role label)

Client (end brand) 1 ──< projects >── M
Agency (also a client row, flagged) 1 ──< agency_brand_links >── M Client(brand)
Project M ──── 1 Client (the end brand)
Project M ──── 0..1 Client (the agency in between, optional)
Project 1 ──< briefs >── M (multi-version)
Project 1 ──< deliverable_groups 1 ──< deliverables >── M
Deliverable 1 ──< revision_rounds 1 ──< revision_items >── M

Equipment M ──── 1 equipment_groups (model/type group, for bulk reservations)
Project 1 ──< equipment_reservations >── M Equipment  (with time range, exclusion)

Polymorphic:
  attachments.entity_type + entity_id  ─> (any major table)
  tag_assignments.entity_type + entity_id
  custom_field_values.entity_type + entity_id
  external_links.entity_type + entity_id  ─> Drive folder / Calendar event / Gmail thread
```

---

## 3. PEOPLE — The Multi-Hat Model

The hardest design decision: every person at Volt does multiple jobs. We model this with **Capabilities** (what a person CAN do) and **Project Assignments** (what they ARE doing on this project).

### 3.1 `profiles` (extending Pillar 1's minimal version)

```typescript
// packages/db/src/schema/people.ts
import { pgTable, uuid, text, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";

export const personStatusEnum = pgEnum("person_status", [
  "active", "inactive", "on_leave", "terminated"
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").unique(),
  email: text("email").notNull().unique(),

  // Display + legal names — they may differ (Abu Luka case)
  displayName: text("display_name").notNull(),           // "أبو لوكا"
  displayNameEn: text("display_name_en"),                // "Abu Luka"
  legalName: text("legal_name"),                          // "محمد المالكي" (for invoices/contracts)

  // System role (NOT the same as project role; project role is per-assignment)
  role: text("role").notNull().default("user"),           // user, manager, system_admin, system_manager
  status: personStatusEnum("status").notNull().default("active"),

  // Acting-on-behalf (e.g., when Mohammed approves for Abu Luka)
  actingForId: uuid("acting_for_id"),

  // Personal
  phoneE164: text("phone_e164"),                          // +9665XXXXXXXX
  whatsappE164: text("whatsapp_e164"),
  avatarUrl: text("avatar_url"),

  // Workspace
  departmentId: uuid("department_id"),
  reportsToId: uuid("reports_to_id"),                     // manager hierarchy

  // Preferences
  uiLanguage: text("ui_language").notNull().default("ar"),   // 'ar' or 'en'
  timezone: text("timezone").notNull().default("Asia/Riyadh"),
  notificationPrefs: jsonb("notification_prefs").default({}),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});
```

### 3.2 `employees` (HR-side fields, 1:1 with profile)

```typescript
export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().unique().references(() => profiles.id, { onDelete: "cascade" }),

  // ID / contracts (KSA-specific)
  nationalId: text("national_id"),                         // Saudi national ID or Iqama
  nationalIdType: text("national_id_type"),                // 'saudi' | 'iqama' | 'visitor'
  nationality: text("nationality"),

  // Job
  jobTitle: text("job_title"),
  hireDate: text("hire_date"),                              // YYYY-MM-DD
  endDate: text("end_date"),
  employmentType: text("employment_type"),                  // 'full_time' | 'part_time' | 'freelancer'

  // Comp (data only — finance module deferred)
  monthlySalary: integer("monthly_salary"),                 // in SAR halalas — integer to avoid float issues
  monthlySalaryCurrency: text("monthly_salary_currency").default("SAR"),

  // Flags
  isFreelancer: boolean("is_freelancer").notNull().default(false),
  canBeShooter: boolean("can_be_shooter").notNull().default(false),
  canBeEditor: boolean("can_be_editor").notNull().default(false),
  canBePilot: boolean("can_be_pilot").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.3 `capabilities` (catalog of "what can someone do")

```typescript
export const capabilities = pgTable("capabilities", {
  key: text("key").primaryKey(),                           // 'shooter', 'editor', 'drone_pilot', 'sound', 'colorist', 'producer', ...
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  category: text("category"),                              // 'production', 'post', 'business', 'admin'
  description: text("description"),
  iconKey: text("icon_key"),
  active: boolean("active").notNull().default(true),
  position: integer("position").notNull().default(0),
});
```

Seed examples:
```
shooter / مصور / Shooter / production
editor / مونتير / Editor / post
colorist / كولرست / Colorist / post
drone_pilot / طيار درون / Drone Pilot / production
sound_engineer / مهندس صوت / Sound Engineer / production
production_manager / مدير إنتاج / Production Manager / business
project_manager / مدير مشاريع / Project Manager / business
account_manager / اكاونت مانجر / Account Manager / business
equipment_manager / مسؤول معدات / Equipment Manager / admin
procurement / مشتريات / Procurement / admin
hr / موارد بشرية / HR / admin
accounting / محاسبة / Accounting / admin
talent / تالنت / Talent / production
ai_specialist / أخصائي AI / AI Specialist / business
trainee / متدرب / Trainee / admin
```

### 3.4 `user_capabilities` (many-to-many)

```typescript
export const userCapabilities = pgTable("user_capabilities", {
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  capabilityKey: text("capability_key").notNull().references(() => capabilities.key),
  isPrimary: boolean("is_primary").notNull().default(false),    // is this their main hat?
  proficiency: integer("proficiency").notNull().default(2),     // 1-5
  notes: text("notes"),
  addedBy: uuid("added_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.profileId, t.capabilityKey] }),
}));
```

### 3.5 `skills` (finer-grained than capabilities — specific tools/techniques)

```typescript
export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),                      // 'premiere_pro', 'davinci_resolve', 'drone_dji_avata', ...
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  category: text("category"),
  parentSkillId: uuid("parent_skill_id"),                   // self-FK for hierarchy
  active: boolean("active").notNull().default(true),
});

export const userSkills = pgTable("user_skills", {
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id),
  level: integer("level").notNull().default(1),             // 1-3
  yearsExperience: integer("years_experience"),
  certifiedAt: timestamp("certified_at", { withTimezone: true }),
  notes: text("notes"),
}, (t) => ({
  pk: primaryKey({ columns: [t.profileId, t.skillId] }),
}));
```

### 3.6 `squads` (recurring teams) — NEW

A squad is a recurring group of people who often work together (e.g., "Hara BMW core team", "Abu Luka content crew", "Travel shoot squad"). Assignments to a project can either be individual profiles or a whole squad.

```typescript
export const squads = pgTable("squads", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  purpose: text("purpose"),                            // 'crew', 'editing_team', 'content_calendar', 'shooting_team'
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const squadMembers = pgTable("squad_members", {
  squadId: uuid("squad_id").notNull().references(() => squads.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  defaultRole: projectAssignmentRoleEnum("default_role"),
  isCore: boolean("is_core").notNull().default(true),    // core vs floating member
  notes: text("notes"),
}, (t) => ({
  pk: primaryKey({ columns: [t.squadId, t.profileId] }),
}));

export const projectSquadAssignments = pgTable("project_squad_assignments", {
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  squadId: uuid("squad_id").notNull().references(() => squads.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.projectId, t.squadId] }),
}));
```

Trigger `tg_explode_squad_assignment`: AFTER INSERT on `project_squad_assignments` — auto-creates `project_assignments` rows for each member of the squad with their `defaultRole`.

### 3.7 `departments` + `work_calendar_defaults`

```typescript
export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                    // 'GM', 'OP', 'F_HR', 'MC', 'CREATIVE'
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  headProfileId: uuid("head_profile_id").references(() => profiles.id),
  position: integer("position").notNull().default(0),
});

export const workCalendarDefaults = pgTable("work_calendar_defaults", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  // Saudi working week: Sun-Thu standard, but Volt's actual practice may vary
  workingDays: text("working_days").array().notNull().default(sql`ARRAY['sun','mon','tue','wed','thu']`),
  dayStartTime: text("day_start_time").notNull().default("09:00"),
  dayEndTime: text("day_end_time").notNull().default("18:00"),
  timezone: text("timezone").notNull().default("Asia/Riyadh"),
});
```

### 3.7 Triggers on People

- `profiles.updated_at` auto-updates.
- On INSERT into `profiles`, create matching `employees` row (idempotent).
- On INSERT/UPDATE/DELETE of any people-domain table → audit log.
- On UPDATE of `profiles.role` → audit log captures `before_role` and `after_role` explicitly in metadata.

### 3.8 RLS pattern for People domain

```sql
-- profiles: every authenticated user reads (for @mentions, assignments); admins write
CREATE POLICY profiles_read ON profiles FOR SELECT USING (auth.role() = 'authenticated');
-- Self-update via column-level permissions: grant only the "safe" columns;
-- role/status/department_id changes require admin (separate policy below).
CREATE POLICY profiles_update_self ON profiles FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
-- A trigger then enforces no-role-escalation:
-- CREATE OR REPLACE FUNCTION fn_block_self_role_escalation() RETURNS trigger LANGUAGE plpgsql AS $$
-- BEGIN
--   IF OLD.role IS DISTINCT FROM NEW.role AND NOT is_admin_caller() THEN
--     RAISE EXCEPTION 'role changes require admin permission';
--   END IF;
--   IF OLD.status IS DISTINCT FROM NEW.status AND NOT is_admin_caller() THEN
--     RAISE EXCEPTION 'status changes require admin permission';
--   END IF;
--   RETURN NEW;
-- END $$;
-- CREATE TRIGGER tg_block_self_role_escalation BEFORE UPDATE ON profiles
--   FOR EACH ROW WHEN (OLD.auth_user_id IS NOT NULL AND OLD.auth_user_id = auth.uid())
--   EXECUTE FUNCTION fn_block_self_role_escalation();
CREATE POLICY profiles_admin_all ON profiles FOR ALL USING (is_admin_caller());

-- employees: HR + admins + self read; HR + admins write
-- capabilities & skills (catalogs): all read, admins write
-- user_capabilities & user_skills: self read, admins/HR write
```

---

## 4. ORGANIZATIONS — Clients, Brands, Agencies, Contacts

### 4.1 `clients` (the unified entity)

A client row can be a brand (end customer), a dealer, or an agency. The `is_agency` flag determines behavior but the schema is the same.

```typescript
// packages/db/src/schema/orgs.ts
export const clientTypeEnum = pgEnum("client_type", ["brand", "dealer", "agency", "other"]);

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                    // e.g., "MYNM", "HRMNY", "ALFUTTAIM"

  // Names
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  legalName: text("legal_name"),                            // for invoicing
  vatNumber: text("vat_number"),
  crNumber: text("cr_number"),                              // Commercial Registration

  // Classification
  clientType: clientTypeEnum("client_type").notNull().default("brand"),
  isAgency: boolean("is_agency").notNull().default(false),  // redundant with type but optimized for filtering
  industry: text("industry"),                                // 'automotive', 'fmcg', ...

  // Contact base
  country: text("country").notNull().default("SA"),
  city: text("city"),
  addressLines: text("address_lines"),
  websiteUrl: text("website_url"),
  logoUrl: text("logo_url"),

  // Payment intel
  defaultPaymentTermsKey: text("default_payment_terms_key"),  // links to payment_terms_catalog (Pillar 7+)
  averagePaymentDays: integer("average_payment_days"),         // derived; updated periodically by background job
  trustScore: integer("trust_score"),                          // 1-5 derived from payment history

  // Status
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  notes: text("notes"),
  customFields: jsonb("custom_fields").notNull().default({}),

  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Computed: tags via tag_assignments (cross-cutting; see §8)
```

### 4.2 `agency_brand_links` (agency ↔ brand many-to-many)

```typescript
export const agencyBrandLinks = pgTable("agency_brand_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyId: uuid("agency_id").notNull().references(() => clients.id),
  brandId: uuid("brand_id").notNull().references(() => clients.id),
  sinceDate: text("since_date"),                            // YYYY-MM-DD
  endDate: text("end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueLink: unique().on(t.agencyId, t.brandId),
  selfCheck: check("agency_brand_self", sql`${t.agencyId} <> ${t.brandId}`),
}));
```

Trigger `enforce_agency_brand_roles`: rejects insert if `agencies.is_agency = false` or `brands.is_agency = true`.

### 4.3 `contacts` (people at clients/agencies)

```typescript
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),

  fullName: text("full_name").notNull(),
  fullNameAr: text("full_name_ar"),
  jobTitle: text("job_title"),
  jobTitleAr: text("job_title_ar"),
  department: text("department"),

  isPrimary: boolean("is_primary").notNull().default(false),
  isDecisionMaker: boolean("is_decision_maker").notNull().default(false),
  preferredLanguage: text("preferred_language").default("ar"),

  notes: text("notes"),
  customFields: jsonb("custom_fields").notNull().default({}),
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 4.4 `contact_methods` (1-to-many: email/phone/whatsapp/etc)

```typescript
export const contactMethodTypeEnum = pgEnum("contact_method_type", [
  "email", "phone", "whatsapp", "linkedin", "instagram", "other"
]);

export const contactMethods = pgTable("contact_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  methodType: contactMethodTypeEnum("method_type").notNull(),
  value: text("value").notNull(),                            // raw value
  normalizedValue: text("normalized_value").notNull(),       // for matching (lowercase email, E.164 phone)
  isPrimary: boolean("is_primary").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueValue: unique().on(t.methodType, t.normalizedValue),
}));
```

### 4.5 Business rules (triggers / functions)

- `tg_contact_method_normalize`: BEFORE INSERT/UPDATE — lowercase emails, E.164 phones.
- `fn_merge_clients(keeper_id uuid, loser_id uuid)`: SECURITY DEFINER, admins only. Moves all FK-referenced rows from loser → keeper, then archives loser. Logs to audit_log.
- `fn_clients_by_active_in_window(months int)`: returns clients with at least one project in last N months. Used by the migration script (§13).

### 4.6 RLS for Orgs domain

- `clients`, `contacts`, `contact_methods`: read = all authenticated; write = `can_manage_business()` (the helper from Pillar 1, extended).
- `agency_brand_links`: same as clients.
- Personal contacts (if Mohammed wants per-user private contacts in future): NOT in Pillar 2. Defer.

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

## 7. MONEY — Schema-Only (Module Deferred)

These tables exist so the data model is complete, but the Finance MODULE (invoicing UI, full AR/AP) is deferred to Phase 2 per Mohammed's scope decision. The tables let us start recording quotes + invoices alongside projects so when the module activates, history exists.

### 7.1 `quotes`

```typescript
export const quoteStatusEnum = pgEnum("quote_status", [
  "draft", "sent", "accepted", "rejected", "expired", "superseded"
]);

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                     // QUO-0001
  projectId: uuid("project_id").references(() => projects.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),

  status: quoteStatusEnum("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  parentQuoteId: uuid("parent_quote_id"),                    // when revising

  // Amounts (SAR)
  subtotalSar: numeric("subtotal_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  discountSar: numeric("discount_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  vatRate: numeric("vat_rate", { precision: 5, scale: 4 }).notNull().default("0.15"),
  vatSar: numeric("vat_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSar: numeric("total_sar", { precision: 12, scale: 2 }).notNull().default("0"),

  // Dates
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  validUntilAt: timestamp("valid_until_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),

  // Payment terms
  paymentTermsText: text("payment_terms_text"),             // free-form for now; structured in Phase 2

  // External refs
  pdfUrl: text("pdf_url"),

  notes: text("notes"),
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quoteLineItems = pgTable("quote_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  quoteId: uuid("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPriceSar: numeric("unit_price_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSar: numeric("total_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  category: text("category"),                               // 'crew', 'equipment', 'location', 'post', ...
});
```

### 7.2 `invoices`

```typescript
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft", "issued", "partially_paid", "paid", "overdue", "cancelled", "written_off"
]);

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                     // INV-00001
  projectId: uuid("project_id").references(() => projects.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  quoteId: uuid("quote_id").references(() => quotes.id),

  status: invoiceStatusEnum("status").notNull().default("draft"),

  // Issued / due
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),

  // Amounts
  subtotalSar: numeric("subtotal_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  vatSar: numeric("vat_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSar: numeric("total_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  paidSar: numeric("paid_sar", { precision: 12, scale: 2 }).notNull().default("0"),

  // ZATCA fields (will populate when e-invoicing is wired)
  zatcaUuid: text("zatca_uuid"),
  zatcaHash: text("zatca_hash"),
  zatcaQrUrl: text("zatca_qr_url"),

  pdfUrl: text("pdf_url"),
  notes: text("notes"),

  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPriceSar: numeric("unit_price_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSar: numeric("total_sar", { precision: 12, scale: 2 }).notNull().default("0"),
  category: text("category"),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amountSar: numeric("amount_sar", { precision: 12, scale: 2 }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  method: text("method"),                                   // 'bank_transfer', 'cheque', 'card', 'cash'
  referenceNumber: text("reference_number"),                // bank ref
  receivedById: uuid("received_by_id").references(() => profiles.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 7.3 Code-generation sequences

```sql
CREATE SEQUENCE IF NOT EXISTS quote_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS invoice_code_seq START WITH 1;

CREATE OR REPLACE FUNCTION fn_next_quote_code() RETURNS text LANGUAGE sql AS $$
  SELECT 'QUO-' || LPAD(nextval('quote_code_seq')::text, 4, '0');
$$;
CREATE OR REPLACE FUNCTION fn_next_invoice_code() RETURNS text LANGUAGE sql AS $$
  SELECT 'INV-' || LPAD(nextval('invoice_code_seq')::text, 5, '0');
$$;

ALTER TABLE quotes ALTER COLUMN code SET DEFAULT fn_next_quote_code();
ALTER TABLE invoices ALTER COLUMN code SET DEFAULT fn_next_invoice_code();
```

### 7.4 Triggers

- `tg_invoice_status_from_payments`: AFTER INSERT/UPDATE/DELETE on payments — recompute `invoice.paid_sar` and `invoice.status` (`paid` if `paid_sar >= total_sar`, `partially_paid` if 0 < paid_sar < total_sar, etc.).
- `tg_quote_total_from_lines`: AFTER any change on quote_line_items — recompute `subtotal_sar`, `vat_sar`, `total_sar`.

### 7.5 RLS

- Read: assignees of the project + finance role + admins.
- Write: account manager + project manager + finance + admins.

---

## 8. EQUIPMENT

### 8.1 `equipment_groups` (model/type for bulk reservation)

```typescript
export const equipmentGroups = pgTable("equipment_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                     // e.g., 'NP-FZ100'
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  category: text("category"),                                // 'camera', 'lens', 'battery', 'lighting', ...
  description: text("description"),
});
```

### 8.2 `equipment`

```typescript
export const equipmentTrackingModeEnum = pgEnum("equipment_tracking_mode", ["unit", "bulk"]);
export const equipmentStatusEnum = pgEnum("equipment_status", ["available", "checked_out", "repair", "lost", "retired"]);

export const equipment = pgTable("equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                     // 'CAM-001', 'BAT-NPFZ100-003'
  groupId: uuid("group_id").references(() => equipmentGroups.id),

  category: text("category").notNull(),                      // 'camera', 'lens', 'battery', 'tripod', ...
  manufacturer: text("manufacturer"),
  model: text("model").notNull(),
  modelNameAr: text("model_name_ar"),
  serialNumber: text("serial_number"),

  trackingMode: equipmentTrackingModeEnum("tracking_mode").notNull().default("unit"),
  quantityTotal: integer("quantity_total").notNull().default(1),

  status: equipmentStatusEnum("status").notNull().default("available"),
  currentLocation: text("current_location").notNull().default("warehouse"),  // 'warehouse', 'in_use', 'repair', 'lost'

  purchaseDate: text("purchase_date"),
  purchasePriceSar: numeric("purchase_price_sar", { precision: 12, scale: 2 }),
  insuranceValueSar: numeric("insurance_value_sar", { precision: 12, scale: 2 }),
  warrantyUntil: text("warranty_until"),

  // Depreciation (data only — finance module computes later)
  depreciationMethod: text("depreciation_method"),         // 'straight_line', 'declining_balance', null
  usefulLifeMonths: integer("useful_life_months"),
  currentBookValueSar: numeric("current_book_value_sar", { precision: 12, scale: 2 }),  // updated by scheduled job

  // Charging (batteries)
  requiresCharging: boolean("requires_charging").notNull().default(false),
  lastChargedAt: timestamp("last_charged_at", { withTimezone: true }),

  // Photo + docs
  photoUrl: text("photo_url"),
  manualUrl: text("manual_url"),

  // Specs (free-form JSON for now; structured indexes come later if needed)
  specs: jsonb("specs").notNull().default({}),

  // Kit membership
  isKitItem: boolean("is_kit_item").notNull().default(false),
  parentKitId: uuid("parent_kit_id"),

  notes: text("notes"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 8.3 `kits` and `kit_items`

```typescript
export const kits = pgTable("kits", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                     // 'KIT-FX6-STD'
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  primaryEquipmentId: uuid("primary_equipment_id").references(() => equipment.id),
  active: boolean("active").notNull().default(true),
});

export const kitItems = pgTable("kit_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  kitId: uuid("kit_id").notNull().references(() => kits.id, { onDelete: "cascade" }),
  equipmentId: uuid("equipment_id").references(() => equipment.id),
  equipmentGroupId: uuid("equipment_group_id").references(() => equipmentGroups.id),
  quantity: integer("quantity").notNull().default(1),
  isMandatory: boolean("is_mandatory").notNull().default(false),
  position: integer("position").notNull().default(0),
  notes: text("notes"),
});
```

### 8.4 `equipment_reservations` (with btree_gist exclusion to prevent overlap)

```typescript
export const equipmentReservations = pgTable("equipment_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  equipmentId: uuid("equipment_id").references(() => equipment.id),
  groupId: uuid("group_id").references(() => equipmentGroups.id),

  projectId: uuid("project_id").references(() => projects.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

  reservedById: uuid("reserved_by_id").references(() => profiles.id),
  status: text("status").notNull().default("reserved"),       // 'reserved', 'checked_out', 'returned', 'cancelled'

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  hasTarget: check("reservation_target", sql`${t.equipmentId} IS NOT NULL OR ${t.groupId} IS NOT NULL`),
  validTimeRange: check("reservation_time", sql`${t.endsAt} > ${t.startsAt}`),
}));
```

The exclusion constraint is added in raw SQL (Drizzle doesn't support it directly):

```sql
-- Block overlapping reservations for the same equipment unit
ALTER TABLE equipment_reservations
  ADD CONSTRAINT no_overlap_per_unit
  EXCLUDE USING gist (
    equipment_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (equipment_id IS NOT NULL AND status IN ('reserved', 'checked_out'));
```

### 8.5 `equipment_activity_log` (per-item event log)

```typescript
export const equipmentActivityLog = pgTable("equipment_activity_log", {
  id: bigserial("id").primaryKey(),
  equipmentId: uuid("equipment_id").notNull().references(() => equipment.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),                  // 'status_change', 'charged', 'repaired', 'firmware_updated', 'inspected'
  summary: text("summary"),
  metadata: jsonb("metadata").default({}),
  actorId: uuid("actor_id").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 8.6 Functions & Triggers for Equipment

```sql
-- Auto-generate codes (prefix per category)
CREATE OR REPLACE FUNCTION fn_next_equipment_code(prefix_in text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE max_n int;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '\d+$') AS int)), 0)
  INTO max_n
  FROM equipment WHERE code LIKE prefix_in || '-%';
  RETURN prefix_in || '-' || LPAD((max_n + 1)::text, 3, '0');
END $$;

-- Sync location based on status + reservations (Pillar 1 helper extended)
CREATE OR REPLACE FUNCTION fn_sync_equipment_location(eq_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  eq_status text;
  has_active_reservation boolean;
BEGIN
  SELECT status INTO eq_status FROM equipment WHERE id = eq_id;
  SELECT EXISTS(
    SELECT 1 FROM equipment_reservations
    WHERE equipment_id = eq_id
      AND status IN ('reserved', 'checked_out')
      AND now() BETWEEN starts_at AND ends_at
  ) INTO has_active_reservation;

  UPDATE equipment SET current_location = CASE
    WHEN eq_status = 'repair' THEN 'repair'
    WHEN eq_status = 'lost' THEN 'lost'
    WHEN has_active_reservation THEN 'in_use'
    ELSE 'warehouse'
  END
  WHERE id = eq_id;
END $$;
```

### 8.7 RLS for Equipment

- Read: all authenticated.
- Write (equipment, kits, reservations): `equipment_manager` capability OR manager+ role OR admin.
- `equipment_activity_log`: read all; insert via trigger only (server-side).

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

## 10. STATE MACHINES REFERENCE

Centralized so any feature pillar can look up.

### 10.1 Project stage transitions

```
lead → brief → quoted → approved → planning → shooting → editing → review → delivered → archived
                            ↓
                          lost
                            ↓
                        cancelled

Backwards allowed:
- review → editing (when revisions needed)
- editing → shooting (rare: re-shoot)
- approved → planning (default forward)

Forbidden:
- delivered → anything except archived
- archived → anything (use admin-only fn_unarchive_project)
- lost → anything except brief (reopen)
```

Enforced by `fn_check_project_stage_transition` trigger.

### 10.2 Deliverable transitions

```
pending → in_progress → submitted → in_review → approved → delivered
                            ↑           ↓
                            └── needs_revision ──┘

Cancel allowed from: any non-delivered state → cancelled
```

### 10.3 Quote transitions

```
draft → sent → accepted | rejected
draft → expired (auto by cron when valid_until_at passes)
accepted → superseded (when a new version is created and accepted)
```

### 10.4 Invoice transitions

```
draft → issued → partially_paid → paid
              ↓
            overdue (auto when now() > due_at and status = issued)
              ↓
          cancelled OR written_off (admin only)
```

### 10.5 Task transitions

```
pending → in_progress → completed
pending | in_progress → blocked → pending | in_progress
any → cancelled (with reason)
```

### 10.6 Equipment status transitions

```
available ↔ checked_out (via reservation activation/return)
available → repair (when issue reported)
repair → available (when fixed)
any → lost (admin only)
any → retired (admin only; terminal)
```

---

## 11. RLS STRATEGY SUMMARY

| Table | Read | Write |
|-------|------|-------|
| profiles | authenticated | self (limited fields) or admin |
| employees | self or hr or admin | hr or admin |
| capabilities, skills, departments | authenticated | admin |
| user_capabilities, user_skills | authenticated | self or admin |
| clients, contacts, contact_methods | authenticated | manager+ or admin |
| agency_brand_links | authenticated | manager+ or admin |
| projects | authenticated | account/project/production manager assigned OR admin |
| project_assignments | authenticated | assigned PM/AM/admin |
| project_tasks, project_comments | authenticated | assignees or admin |
| daily_tasks | self (owner or assigner) or admin | self or admin |
| briefs | authenticated | assignees or admin |
| deliverables, revision_rounds | authenticated | assignees or admin |
| quotes, invoices, payments | assigned + finance + admin | account_manager + finance + admin |
| equipment, kits | authenticated | equipment_manager + manager+ + admin |
| equipment_reservations | authenticated | reserver OR equipment_manager OR admin |
| attachments | authenticated (read), entity-scoped write | entity-scoped |
| tags, tag_assignments | authenticated | authenticated for assignments; admin for tag defs |
| custom_field_definitions, custom_field_values | authenticated | admin for defs; entity-scoped for values |
| external_links | authenticated | entity-scoped |
| notifications | self only | server (trigger) only |
| notification_subscriptions | self | self |
| activity_events | authenticated | server (trigger) only |

All policies will be implemented via `helpers.sql` functions established in Pillar 1: `is_admin_caller()`, `can_manage_business()`, `is_assigned_to_project(project_id)`, `has_capability('equipment_manager')`, etc.

---

## 12. TRIGGER CATALOG

| Trigger | Table | When | Purpose |
|---------|-------|------|---------|
| `tg_audit_row_change` | every table | AFTER INSERT/UPDATE/DELETE | Write to audit_log |
| `tg_set_updated_at` | every table with `updated_at` | BEFORE UPDATE | Set `updated_at = now()` |
| `tg_normalize_contact_method` | contact_methods | BEFORE INSERT/UPDATE | Lowercase emails, E.164 phones |
| `tg_enforce_agency_brand_roles` | agency_brand_links | BEFORE INSERT/UPDATE | Verify agency/brand flags |
| `tg_auto_create_employee` | profiles | AFTER INSERT | Create matching employees row |
| `tg_log_project_stage` | projects | AFTER UPDATE OF stage | Insert into project_stages_log |
| `tg_check_project_stage_transition` | projects | BEFORE UPDATE OF stage | Reject illegal transitions |
| `tg_invalidate_project_ai_status` | projects, project_tasks, deliverables | AFTER state-relevant change | Set projects.ai_analyzed_at = NULL |
| `tg_bump_deliverable_version` | deliverables | BEFORE UPDATE | Increment version on URL change |
| `tg_check_project_auto_deliver` | deliverables | AFTER UPDATE OF status | Advance project to 'delivered' when all are |
| `tg_sync_equipment_location` | equipment_reservations | AFTER INSERT/UPDATE/DELETE | Call fn_sync_equipment_location |
| `tg_log_equipment_status` | equipment | AFTER UPDATE | Insert into equipment_activity_log |
| `tg_invoice_status_from_payments` | payments | AFTER INSERT/UPDATE/DELETE | Recompute invoice.paid_sar + status |
| `tg_quote_total_from_lines` | quote_line_items | AFTER INSERT/UPDATE/DELETE | Recompute quote totals |
| `tg_emit_activity_on_status` | many | AFTER UPDATE of status | Insert into activity_events with Arabic summary |

A single Drizzle migration file per pillar attaches these. They are NOT in Drizzle schema — they're raw SQL in the migration.

---

## 13. NAMING & ID CONVENTIONS

### 13.1 Identifiers

- All PKs are `uuid` defaulted to `gen_random_uuid()`.
- All "user-facing" codes are TEXT with a prefix:
  - Project: `PRJ-NNNN` (sequence-backed)
  - Quote: `QUO-NNNN`
  - Invoice: `INV-NNNNN`
  - Equipment: `<CAT>-NNN` (e.g., CAM-001, LEN-012)
  - Kit: `KIT-XXX`
  - Order (Pillar 6): retain `VLT-NNNN` from old system if migrating, else new sequence

### 13.2 Timestamps

- All timestamps are `timestamp with time zone`.
- All fields named `*_at` for points in time, `*_on` for dates (rare).
- Audit triggers populate; no manual `created_at` writes.

### 13.3 Status enums

- Always lowercase snake_case values.
- Always include a "terminal" state explicitly (cancelled, archived, delivered, etc.).

### 13.4 Localization

- Tables with user-facing labels have `*_ar` (required) and `*_en` (optional).
- Tables without (technical-only): English only.
- Database is in UTF-8; Arabic stored as Arabic.

### 13.5 Soft-delete vs hard-delete

- **Soft-delete (archived_at)**: clients, contacts, projects, equipment, profiles, deliverables.
- **Hard-delete OK**: tag_assignments, attachments (replaced by new uploads), session-y tables.
- **Never delete**: audit_log, activity_events, ai_usage, payments.

---

## 14. INITIAL SEED DATA (run after schema is created)

`packages/db/src/seed.ts` populates the static lookup tables:

- 15 capabilities (per §3.3).
- 30+ skills (Premiere Pro, DaVinci Resolve, Final Cut Pro, After Effects, Lightroom, Photoshop, drone models, camera models, sound tools, etc.).
- 5 departments (GM, OP, F_HR, MC, CREATIVE).
- 25+ notification event types (project.assigned, task.overdue, deliverable.submitted, brief.received, quote.sent, invoice.overdue, equipment.due_back, attendance.missed, ai.daily_brief_ready, etc.).
- 20+ tags (urgent, priority_high, abu_luka_content, social_only, internal, do_not_archive, etc.).
- 10+ custom_field_definitions (project: campaign_code, vehicle_model, usage_rights, social_platforms; client: agency_for_brands, primary_language).

---

## 15. INITIAL MIGRATION FROM OLD DB

Now we extend the staging table `legacy_equipment_import` (created in Pillar 1) into a full per-domain import:

| Old Supabase table | New Antagna staging | Mapping |
|---|---|---|
| `equipment` (all 162 rows where `effective_status != 'lost'`) | `legacy_equipment_import` → `equipment` | Map status, group by category to `equipment_groups`, generate new `code` with prefix |
| `clients` where active (project in last 12 months) | `legacy_clients_import` → `clients` | Preserve name, set `is_agency` from old data, generate new `code` from name |
| `client_contacts` for active clients | `legacy_contacts_import` → `contacts` + `contact_methods` (split emails/phones into rows) | |
| `projects` where stage in (brief, quoted, approved, planning, shooting, editing, review) | `legacy_projects_import` → `projects` | Map old stages to new enum; deliverables NOT migrated, recreated as needed |

The migration script runs in two phases:
1. **Dry-run**: write to `legacy_*_import` tables, report counts + integrity issues.
2. **Apply**: with `--confirm` flag, move from staging into real tables.

Migration runs ONCE before launch. Old DB stays read-only for reference.

---

## 16. ACCEPTANCE CHECKLIST — Pillar 2 is DONE when:

- [ ] All Drizzle schemas in `packages/db/src/schema/{people,orgs,projects,deliverables,money,equipment,cross-cutting}.ts` compile.
- [ ] `pnpm db:gen` generates a single migration file.
- [ ] Migration applies cleanly to staging Supabase.
- [ ] All trigger functions present and tested.
- [ ] Test seed (`pnpm db:seed-test`) creates: 5 profiles with capabilities, 3 clients (1 brand, 1 agency, 1 with both), 2 projects (one through agency, one direct), 4 deliverables per project, 1 quote, 1 invoice, 10 equipment items, 1 kit, 1 reservation.
- [ ] Query verification (all return expected): `SELECT * FROM projects WHERE stage = 'shooting'`, `SELECT * FROM equipment_reservations WHERE tstzrange(starts_at, ends_at) && tstzrange(now(), now() + interval '7 days')`, `SELECT * FROM activity_events ORDER BY created_at DESC LIMIT 20`.
- [ ] Trigger verification: change project stage → row appears in `project_stages_log`. Insert payment → invoice.status auto-updates. Try overlapping reservation → exclusion constraint rejects.
- [ ] RLS verification: as non-admin user, can read all projects, can edit only assigned ones, can read but not write `clients`.
- [ ] Audit verification: every test action creates an `audit_log` row.
- [ ] Migration script imports ≥ 162 equipment + ≥ 20 active clients with 0 FK violations.
- [ ] `pnpm type-check` passes everywhere.

---

## 17. WHAT'S NOT IN PILLAR 2 (deferred to feature pillars)

- **Equipment compatibility rules** (`compatibility_rules`, `compat_feedback`) → Pillar 6
- **Email/WhatsApp message tables** (`inbound_email_threads`, `inbound_email_messages`, `email_drafts`, `whatsapp_*`) → Pillar 8
- **Social-media tables** (`managed_accounts`, `content_calendar_entries`, `posts`, `analytics_snapshots`) → Pillar 7
- **Attendance tables** (`attendance_records`, `selfie_verifications`, `work_sessions`) → Pillar 9
- **Automation/alert rule tables** (`alert_rules`, `alert_fires`, `chase_templates`) → Pillar 11
- **AI feature tables beyond Pillar 1** (`project_insights`, `project_digests`, `project_learnings`, `user_ai_briefs`) → Pillar 10
- **Discovery module** (`discovery_*`) — admin-only research notebook; deferred unless Mohammed wants it in MVP
- **Skills system extensions** (multi-level certifications, expiry tracking) — Pillar 9 if needed
- **Meeting tables** (`meetings`, `meeting_attendees`, `meeting_decisions`, `meeting_action_items`) → Pillar 8 (alongside Gemini integration)
- **Public client portal** (`get_shared_project` function and views) → Pillar 8

---

## 18. RISKS & OPEN ITEMS

1. **Polymorphic columns** (`entity_type` + `entity_id` in attachments/tags/etc.) don't have FK enforcement. We mitigate via convention + triggers that reject invalid `entity_type` values. Worth revisiting if it bites us.

2. **Soft-delete vs RLS interaction**: when `archived_at IS NOT NULL`, default behavior is hide. But admins need to see archived. We add `WHERE archived_at IS NULL` to default views and provide admin-only views with archived included.

3. **Numeric vs integer for currency**: SAR amounts are `numeric(12,2)` (e.g., 1,234.56). For employee salaries, we used `integer` halalas (1 SAR = 100 halalas) to avoid float comparison issues. Decide before coding which convention sticks. **Decision: `numeric(12,2)` everywhere for SAR — Postgres handles it precisely; the halalas idea adds friction.**

4. **`acting_for_id` on profiles**: today it's a self-FK on profiles. When Abu Luka gets his account, Mohammed's `acting_for_id` might point at Abu Luka. UI must surface this clearly so other team members know "Mohammed approved this on behalf of Abu Luka".

5. **Initial migration of historical data**: not in scope (Mohammed confirmed only active + equipment). But we keep the dry-run script generic so we can pull more later if needed.

6. **External freelancers**: `project_assignments.external_name` is text. Down the line we might want them to be proper contacts. Decision: stay as text for now; if a freelancer recurs 3+ times, the system suggests creating a `contacts` row (Pillar 11 automation).

---

## 19. NEXT PILLAR PREVIEW

**Pillar 3 — Identity, Permissions & Multi-Role** picks up where this leaves off:
- The role / capability / permission resolver functions.
- The Google Workspace SSO flow end-to-end (with the `voltsaudi.com` domain restriction).
- The "I'm acting for Abu Luka" UI pattern.
- The permission-to-action mapping (who can change a project stage; who can issue an invoice).
- Test fixtures for every role's view of the system.

When Pillar 2 acceptance checklist is fully ticked off, open `pillar-03-identity-permissions.md`.

---

**End of Pillar 2.**
