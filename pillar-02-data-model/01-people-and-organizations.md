# Pillar 2 — People & Organizations

> Part of **Pillar 2 (Data Model)** — see [`../pillar-02-data-model.md`](../pillar-02-data-model.md) for overview + index.
> Sections: **§3 PEOPLE**, **§4 ORGANIZATIONS**.

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

