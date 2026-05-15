# Pillar 2 — Data Model (Core Backbone)

**Status:** In progress
**Depends on:** Pillar 1 complete
**Estimated effort:** 2-3 Claude Code sessions on Ubuntu

> **🩹 Patches (see [pillar-16-hardening.md](pillar-16-hardening.md)):** — large number, scan §B, §D, §N, §O
> - **§B.3** — drop `projects.share_token` column; share links live in `project_share_views` (Pillar 5 §3.3)
> - **§B.4** — RLS `OLD.role` bug → moved enforcement to `fn_block_self_role_escalation` trigger
> - **§B.5** — `equipment_groups` count is ~60 (one per model), not by category
> - **§D.2** — NEW table `talents` (Maha + similar external collaborators)
> - **§D.3** — NEW table `freelancers` (recurring external collaborators)
> - **§D.4** — NEW table `locations` (first-class, not free-text)
> - **§D.5** — NEW table `equipment_profiles` (per-context settings per item)
> - **§D.6** — cascade rules updated for PDPL retention
> - **§N.1-N.2** — NEW tables for internal approval workflow (D-026): `deliverable_reviews`, etc.
> - **§O.1** — `dafterah_*_number` reference fields added to projects (D-022)

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


---

## 🗂️ How Pillar 2 is organized

This file holds the **overview** (Goals, Entity Map, State Machines, Naming, Acceptance, Risks). The actual table definitions live in [`pillar-02-data-model/`](pillar-02-data-model/) — one file per topic:

| File | Sections | What's in it |
|---|---|---|
| [`01-people-and-organizations.md`](pillar-02-data-model/01-people-and-organizations.md) | §3 — §4 | `profiles`, capabilities, clients, brands, agencies, contacts |
| [`02-projects-and-briefs.md`](pillar-02-data-model/02-projects-and-briefs.md) | §5 — §6 | `projects`, assignments, briefs, deliverables, revisions |
| [`03-money-and-equipment.md`](pillar-02-data-model/03-money-and-equipment.md) | §7 — §8 | `quotes`, `invoices` (schema-only per D-022), `equipment`, `equipment_groups` |
| [`04-cross-cutting.md`](pillar-02-data-model/04-cross-cutting.md) | §9 | `attachments`, `audit_log`, `ai_usage`, `comments`, `mentions` |
| [`05-rls-and-triggers.md`](pillar-02-data-model/05-rls-and-triggers.md) | §11 — §12 | RLS policy matrix + trigger catalog (patched per §16 B.4) |
| [`06-seed-and-migration.md`](pillar-02-data-model/06-seed-and-migration.md) | §14 — §15 | initial seed data, migration from old VOLT OS |

Authoritative team roster (for the seed) is machine-readable at [`config/roles.yaml`](config/roles.yaml).

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
