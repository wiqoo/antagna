# Pillar 16 — Blueprint Hardening (Peer Review Patch)

**Status:** Active — supersedes specific sections of earlier pillars where noted
**Created:** 2026-05-14
**Trigger:** External peer review (another Claude session) identified gaps before any code is written.

This document is the canonical patch to Pillars 1–15. Every fix is listed with: what changed, why, where it applies, and (when relevant) the corrected schema/code. Claude Code reads this file ALONGSIDE the original pillars — wherever this file specifies, this wins.

---

## A. Canonical Team Roster (authoritative)

The single source of truth for who's on the team. Used for `profiles` seeding.

| # | Name (AR / EN) | Role (system) | Capabilities (multi-hat) | Email |
|---|---------------|---------------|--------------------------|-------|
| 1 | محمد غريب (Mohammed Ghareeb) — the user | `system_admin` | production_manager (primary), shooter, editor, ai_specialist | `ghareib@voltsaudi.com` |
| 2 | أبو لوكا (Abu Luka) — legal name محمد المالكي | `general_manager` | director, talent, approver | new mailbox TBD (current is dropped) |
| 3 | خالد الغامدي (Khaled AlGhamdi) | `project_manager` | project_manager (primary) | `khalid@voltsaudi.com` |
| 4 | عبدالله منصوري (Abdullah Mansoury) | `account_manager` | account_manager (primary) | `mansouri@voltsaudi.com` |
| 5 | حمادة (Hamada) | `user` | shooter, editor (priority for Abu Luka content + social media) | `hamada@voltsaudi.com` |
| 6 | محسن (Mohsen) | `user` | shooter, editor | `mohsen@voltsaudi.com` |
| 7 | مساعد (Musa3ed) | `user` | equipment_manager (primary) | `musaed@voltsaudi.com` |
| 8 | أحمد (Ahmed) | `user` | trainee | TBD |
| 9 | كبسي (Kabsy) | `user` | procurement (primary), talent (managed social media account, early stage) | `alkibsi@voltsaudi.com` |
| 10 | تركي (Turky) | `hr` | hr (primary) | `hr@voltsaudi.com` |
| 11 | حسين (Hussein) | `finance` | accounting (primary) | `finance@voltsaudi.com` |

**Total: 11 people.** Abu Luka and Mohammed Almalki are the SAME person. Mohammed Ghareeb is a DIFFERENT person.

A `Hammad` previously appeared in older notes — that was a misread of `Hamada`. Not a separate person. Drop from any seed scripts.

---

## B. Locked Technical Conflict Fixes

### B.1 Trigger.dev consistency
All references to "Inngest" in pillar bodies are replaced with "Trigger.dev v3". Acceptance: `grep -i "Inngest" antagna-blueprint/ | wc -l` should return 0 (or only historical references in `decisions-log.md` annotated as superseded).

### B.2 Trigger.dev tier from day 1
**Start on Pro tier ($25/mo)**. The free tier (5K runs/month) is exhausted in the first week given:
- Email parser: ~50/day = 1500/mo
- Memory chunker: ~200/day = 6000/mo
- Insights scanner: 30-min cadence = 1440/mo
- Alert scanner: 5-min cadence = 8640/mo
- Daily briefs: 11 users = 330/mo
- Various others
→ ~25K runs/month conservatively. Pro = 100K, fits with headroom.

### B.3 share_token resolution
Pillar 2 §5.1 had `projects.share_token uuid unique`. Pillar 5 §3.3 introduces `project_share_views`. Decision: **drop the column from `projects`**. All share links live in `project_share_views`. Pillar 2 §5.1 has been edited to reflect this.

### B.4 RLS bug — `OLD.role` in WITH CHECK
`OLD` is not available in RLS policies (only in triggers). Pillar 2 §3.8 has been corrected: the RLS policy permits self-update, and a separate `fn_block_self_role_escalation` trigger enforces no-role-escalation. SQL provided in Pillar 2.

### B.5 equipment_groups count: by MODEL, not category
**Decision: ~60 groups, one per equipment model** (FX6, A7iii, NP-FZ100, BP-60, etc.). This makes `kit_suggestions` precise (FX6 needs BP-60 specifically, not "battery"). Pillar 6 §7 stands; Pillar 2 §15 (migration) revised below.

```sql
-- Migration mapping:
-- INSERT INTO equipment_groups (code, name_en, category)
-- SELECT DISTINCT
--   COALESCE(NULLIF(model_name_official, ''), model) AS code,
--   COALESCE(model_name_official, model) AS name_en,
--   category
-- FROM legacy_equipment_import;
-- → ~60 group rows
```

---

## C. Legal / Compliance Fixes

### C.1 ZATCA — elevated to Pillar 13, not deferred

**Status:** URGENT decision for Mohammed Ghareeb + Hussein.

Saudi ZATCA Phase 2 e-invoicing waves are now active. Wave 23 (annual revenue > 750K SAR) had a March 31, 2026 deadline; Wave 24 (375K-750K SAR) is June 30, 2026. Volt's revenue almost certainly puts it in Wave 23 — meaning the compliance deadline has passed.

**The plan:**
1. **Now (Mohammed + Hussein)**: confirm Volt's compliance posture. Is Volt already issuing ZATCA-compliant invoices via Wafeq / Zoho / a 3rd-party? If yes, Antagna integrates with that workflow. If no, immediate intermediate step: use a SaaS provider until Antagna's submission is built.

2. **Pillar 13 §7 expanded**: Antagna generates the UBL 2.1 XML correctly from day 1 with:
   - Unique UUID per invoice (already in schema)
   - Invoice hash (chained from previous invoice's hash)
   - QR code (PDF/A-3 embedded with cryptographic signature)
   - CSID (Cryptographic Stamp Identifier) onboarded from ZATCA portal

3. **Library**: use `zatca-einvoice-sdk` (npm) or partner with a certified provider (Mezan, ClearTax KSA, Orchida). Submission API integration in Pillar 13.

4. **Schema-side ready**: `invoices.zatca_uuid`, `zatca_hash`, `zatca_qr_url` already in Pillar 2. Adding:
   ```typescript
   // Pillar 2 patch:
   invoices.zatcaPreviousHash: text("zatca_previous_hash"),     // hash of preceding invoice for chaining
   invoices.zatcaCsidThumbprint: text("zatca_csid_thumbprint"),
   invoices.zatcaSubmissionStatus: text("zatca_submission_status"),  // 'pending', 'cleared', 'reported', 'rejected'
   invoices.zatcaClearedAt: timestamp("zatca_cleared_at", { withTimezone: true }),
   invoices.zatcaReportingApiResponse: jsonb("zatca_reporting_api_response"),
   ```

**Action item for Mohammed:** kalem Hussein this week. If Volt is past Wave 23 deadline without compliance, immediate intermediate solution needed.

### C.2 PDPL — Face matching removed (Pillar 9)

See §D.1 below for the schema change. Reasoning:
- Biometric data is Sensitive Personal Data under PDPL.
- Frankfurt storage of face embeddings without SCC + risk assessment = violation.
- Mohammed's original request was "selfie + location + time" — never asked for face matching.
- PIN + GPS + selfie (as audit artifact) is sufficient for the actual use case (attendance verification, not identity authentication).

### C.3 PDPL Subject Rights — promoted to features (Pillar 12)

Adds to Pillar 12 spec:

- **Data Export** page (`/app/me/privacy/export`): user clicks → server queues background task → emails them a `.zip` containing their profile + activity_events + their tasks + their messages within 30 days.
- **Data Deletion / Anonymization** (`/app/me/privacy/delete`): user requests deletion → admin reviews → anonymization (not hard delete; replace identifiers with synthetic strings, keep audit_log and activity_events with anonymized actor).
- **Rectification**: profile page allows direct edit of own data fields.
- **Object to processing**: per-feature opt-out toggles (e.g., disable AI memory ingestion of user's own activity).
- **Data portability**: same as Data Export — JSON + CSV in the zip.

Each is a route under `/app/me/privacy/*` with proper logging to `audit_log`.

---

## D. Data Model Additions (extend Pillar 2)

### D.1 Pillar 9 attendance schema corrected

Replaces the face-matching design:

```typescript
// employees gets a PIN field:
employees.pinHash: text("pin_hash"),              // bcrypt

// attendance_records — corrected from Pillar 9 §3.2:
export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  type: attendanceTypeEnum("type").notNull(),

  // Audit artifacts (no biometric processing)
  selfieUrl: text("selfie_url").notNull(),
  selfieHash: text("selfie_hash"),                // sha256 for 24h replay-attack check
  pinVerified: boolean("pin_verified").notNull().default(false),

  // Location
  gpsLat: numeric("gps_lat", { precision: 10, scale: 7 }),
  gpsLng: numeric("gps_lng", { precision: 10, scale: 7 }),
  gpsAccuracyMeters: numeric("gps_accuracy_meters", { precision: 8, scale: 2 }),
  resolvedLocationLabel: text("resolved_location_label"),
  geoFenceId: uuid("geo_fence_id"),

  // Time
  clientTimestamp: timestamp("client_timestamp", { withTimezone: true }),
  serverTimestamp: timestamp("server_timestamp", { withTimezone: true }).notNull().defaultNow(),
  timeDeltaMs: integer("time_delta_ms"),

  // Context
  associatedProjectId: uuid("associated_project_id").references(() => projects.id),
  associatedCalendarEventId: text("associated_calendar_event_id"),

  // Verification result
  verification: attendanceVerificationEnum("verification").notNull(),
  overrideByProfileId: uuid("override_by_profile_id").references(() => profiles.id),
  overrideReason: text("override_reason"),

  deviceInfo: jsonb("device_info"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### D.2 NEW — `talents` (Maha case)

A talent is neither a profile nor a client. They are a person Volt represents on social media or in productions.

```typescript
export const talentContractTypeEnum = pgEnum("talent_contract_type", [
  "exclusive", "non_exclusive", "project_based", "ad_hoc", "unsigned_potential"
]);

export const talents = pgTable("talents", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                    // 'TAL-0001'
  displayName: text("display_name").notNull(),               // 'مها'
  displayNameEn: text("display_name_en"),
  legalName: text("legal_name"),
  nationalIdLast4: text("national_id_last4"),                // for contracts; only last 4 stored, not full

  // Type
  contractType: talentContractTypeEnum("contract_type").notNull().default("project_based"),
  commissionPct: numeric("commission_pct", { precision: 5, scale: 2 }),
  signedContractAt: text("signed_contract_at"),              // YYYY-MM-DD

  // Contact
  primaryContactId: uuid("primary_contact_id").references(() => contacts.id),
  phoneE164: text("phone_e164"),
  whatsappE164: text("whatsapp_e164"),

  // Talent profile
  category: text("category"),                                // 'auto_influencer', 'lifestyle', 'creator', etc.
  niches: text("niches").array(),
  languages: text("languages").array(),
  cityBase: text("city_base"),
  preferences: jsonb("preferences"),                         // free-form: best time to work, dietary, etc.

  // Bank for payouts (encrypted column or Vault ref)
  payoutMethodRef: text("payout_method_ref"),

  active: boolean("active").notNull().default(true),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// And update managed_accounts (Pillar 7):
// managed_accounts.ownerTalentId: uuid("owner_talent_id").references(() => talents.id)
// At least one of (ownerProfileId, ownerClientId, ownerTalentId) must be set.
```

Maha's row: `displayName='مها'`, `contractType='project_based'`, linked to her managed Instagram account in `managed_accounts.ownerTalentId`.

### D.3 NEW — `freelancers` (recurring external collaborators)

```typescript
export const freelancers = pgTable("freelancers", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                    // 'FRL-0001'
  fullName: text("full_name").notNull(),
  fullNameAr: text("full_name_ar"),

  primaryContactId: uuid("primary_contact_id").references(() => contacts.id),
  phoneE164: text("phone_e164"),
  emailPrimary: text("email_primary"),

  specialties: text("specialties").array(),                  // ['editor', 'colorist', 'drone_pilot']
  cityBase: text("city_base"),

  // Rate history
  defaultRateSar: numeric("default_rate_sar", { precision: 10, scale: 2 }),
  defaultRateUnit: text("default_rate_unit"),               // 'per_day', 'per_project'

  // Payout
  payoutMethodRef: text("payout_method_ref"),
  taxId: text("tax_id"),                                     // their VAT if applicable

  // Quality signals (derived)
  projectsCompleted: integer("projects_completed").notNull().default(0),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }),
  lastWorkedAt: timestamp("last_worked_at", { withTimezone: true }),
  preferred: boolean("preferred").notNull().default(false),

  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// project_assignments (Pillar 2 §5.3) gets:
// freelancerId: uuid("freelancer_id").references(() => freelancers.id)
// Validation: exactly one of (profileId, freelancerId, externalName) is set.
```

### D.4 NEW — `locations` (first-class)

```typescript
export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                    // 'LOC-0001'
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  clientId: uuid("client_id").references(() => clients.id), // when site belongs to a client (e.g., showroom)

  city: text("city"),                                        // 'Jeddah', 'Riyadh', 'Dammam', ...
  district: text("district"),
  addressLines: text("address_lines"),
  countryCode: text("country_code").notNull().default("SA"),
  coordinates: text("coordinates"),                          // 'lat,lng' (using text to avoid PostGIS dependency)

  geoFenceId: uuid("geo_fence_id").references(() => geoFences.id),

  // Production intel
  bestTimeToShoot: text("best_time_to_shoot"),
  parkingInfo: text("parking_info"),
  permitRequired: boolean("permit_required").notNull().default(false),
  permitProvider: text("permit_provider"),                   // e.g., 'Ministry of Tourism', 'NEOM Permits'
  knownChallenges: text("known_challenges"),

  // Operations
  contactAtLocation: uuid("contact_at_location").references(() => contacts.id),
  insideBuilding: boolean("inside_building"),
  hasPower: boolean("has_power"),
  hasParkingForCrew: boolean("has_parking_for_crew"),

  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// projects gets:
// projects.locationId: uuid("location_id").references(() => locations.id)
// (alongside existing free-text location field for flexibility)
```

Seed example: `LOC-0001` = "Hara BMW showroom — Jeddah" linked to MYNM client.

### D.5 NEW — `equipment_profiles` (per-context settings)

```typescript
export const equipmentProfiles = pgTable("equipment_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  equipmentId: uuid("equipment_id").notNull().references(() => equipment.id),
  contextType: text("context_type").notNull(),              // 'location' | 'client' | 'subject_type' | 'general'
  contextId: uuid("context_id"),
  contextLabel: text("context_label"),
  recommendedSettings: jsonb("recommended_settings"),       // free-form camera/light specs
  knownIssues: text("known_issues"),
  notes: text("notes"),
  derivedFromProjectIds: uuid("derived_from_project_ids").array(),  // for auditability
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Seed example: equipment_id=FX6, contextType='location', contextId=Hara_BMW.id, recommendedSettings={ ISO: 800, white_balance: 5600, ... }.

### D.6 Cascade fix (PDPL retention)

Audit-style tables must NOT lose rows when their parent is deleted/archived. Patch Pillar 2:

```sql
-- All historical tables use SET NULL or NO ACTION, not CASCADE:
ALTER TABLE activity_events DROP CONSTRAINT activity_events_project_id_fkey;
ALTER TABLE activity_events ADD CONSTRAINT activity_events_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Same for audit_log, ai_usage, kpi_snapshots, ai_memory_chunks.
-- Projects themselves never hard-delete — they archive.
```

---

## E. AI Learning Tables (Pillar 10 extensions)

### E.1 NEW — `project_learnings`

```typescript
export const projectLearnings = pgTable("project_learnings", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: text("scope").notNull(),                            // 'client' | 'location' | 'talent' | 'crew' | 'general'
  scopeId: uuid("scope_id"),
  learningType: text("learning_type").notNull(),             // 'duration_pattern', 'revision_pattern', 'payment_pattern', 'equipment_pattern', 'communication_pattern'

  insightAr: text("insight_ar").notNull(),
  insightEn: text("insight_en"),
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull(),  // 0-1
  sampleSize: integer("sample_size").notNull(),

  derivedFromProjectIds: uuid("derived_from_project_ids").array(),
  derivedFromActivityEventIds: bigint("derived_from_activity_event_ids").array(),

  // Validation
  validatedById: uuid("validated_by_id").references(() => profiles.id),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),

  // Lifecycle
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),  // learnings get stale
  supersededByLearningId: uuid("superseded_by_learning_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Weekly Trigger.dev task `extract-project-learnings`:
- Scans projects moved to `delivered` in the last week.
- For each, queries deliverables/revisions/payments/comms history.
- Calls Claude Sonnet to identify patterns (with cached system prompt).
- Inserts learnings with confidence score.
- Deduplicates against existing learnings (vector-similarity on insight text).
- Monthly task: lower confidence on learnings older than 12 months; expire if confidence drops below 0.4.

### E.2 NEW — `decision_outcomes`

```typescript
export const decisionOutcomes = pgTable("decision_outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),

  // The decision
  decisionType: text("decision_type").notNull(),             // 'lead_scoring', 'chase_suggestion', 'equipment_swap', 'template_choice', 'priority_routing'
  decisionMadeAt: timestamp("decision_made_at", { withTimezone: true }).notNull(),
  decisionBy: text("decision_by").notNull(),                 // 'ai' | 'human:<profile_id>'
  aiUsageId: bigint("ai_usage_id"),                          // FK to ai_usage row
  decisionInput: jsonb("decision_input"),                    // what we knew at decision time
  decisionOutput: jsonb("decision_output"),                  // what was decided

  // The outcome (filled later)
  outcomeMeasuredAt: timestamp("outcome_measured_at", { withTimezone: true }),
  outcomeLabel: text("outcome_label"),                       // 'success' | 'partial' | 'failure' | 'inconclusive'
  outcomeDetail: jsonb("outcome_detail"),
  outcomeFollowupBy: timestamp("outcome_followup_by", { withTimezone: true }),  // when we expect to know

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Weekly reflection task `reflect-on-ai-decisions`:
- For each decision_outcomes row where outcomeMeasuredAt IS NULL AND outcomeFollowupBy < now():
- Resolve the outcome based on observable signals (lead converted? client paid? equipment swap succeeded?).
- Insert outcomeLabel + outcomeDetail.
- Aggregates monthly: AI lead scoring achieved 0.78 precision last month; AI chase suggestion 0.41 success rate.

### E.3 Memory chunk quality signals (Pillar 10 §4 patch)

```typescript
// ai_memory_chunks gets:
aiMemoryChunks.relevanceScore: numeric("relevance_score", { precision: 3, scale: 2 }),  // 0-1
aiMemoryChunks.retrievalCount: integer("retrieval_count").notNull().default(0),
aiMemoryChunks.lastRetrievedAt: timestamp("last_retrieved_at", { withTimezone: true }),
aiMemoryChunks.useful: boolean("useful"),                  // null until we know
```

Every retrieval call increments `retrievalCount` and updates `lastRetrievedAt`. After each AI call that used retrieved chunks, the calling code marks chunks as `useful=true` if the AI cited them, or leaves null if not used.

Memory hygiene cron monthly:
- DELETE chunks where `retrievalCount = 0 AND created_at < now() - 6 months`.
- Lower `relevanceScore` for chunks with low usefulness ratio.
- Re-summarize project-scope chunks when project archives (collapse N chunks into one summary).

### E.4 NEW — `template_edit_patterns`

```typescript
export const templateEditPatterns = pgTable("template_edit_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateKey: text("template_key").notNull().references(() => emailTemplates.key),
  emailDraftId: uuid("email_draft_id").references(() => emailDrafts.id),
  editorProfileId: uuid("editor_profile_id").references(() => profiles.id),
  fieldEdited: text("field_edited"),                        // 'subject' | 'body' | 'signature'
  originalText: text("original_text"),
  editedText: text("edited_text"),
  editDiff: jsonb("edit_diff"),                              // structured diff
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Monthly task `analyze-template-edits`:
- For each template, find edits made 5+ times with similar patterns.
- Surface to admin: "template `chase_30d` had this phrase removed 7 times — consider updating".

### E.5 NEW — `state_transition_overrides` (learning from admin overrides)

```typescript
export const stateTransitionOverrides = pgTable("state_transition_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),                 // 'project' | 'deliverable' | 'quote' | 'invoice'
  entityId: uuid("entity_id").notNull(),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  byProfileId: uuid("by_profile_id").references(() => profiles.id),
  reason: text("reason"),
  illegalTransition: boolean("illegal_transition").notNull().default(false),  // was the state machine bypassed?
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Captured by the state-transition trigger (Pillar 5) whenever an admin override is invoked. Monthly review surface to admin: "Of last month's project state overrides, 8/10 were `review → editing` — should the state machine allow this transition non-admin?"

---

## F. WhatsApp Inbound — Phase 1 (was Phase 2)

WhatsApp Business Cloud API direct integration (no BSP) for INBOUND in Phase 1. Outbound stays Phase 2.

### F.1 Provisioning timeline (parallel with build)

- Week 1: Mohammed creates Meta Business account + WhatsApp Business Account + verifies business documents (CR + VAT).
- Week 2: provisioned phone number (~ +966 dedicated number), Webhook URL configured.
- Week 3: integration tests, go live.

This work happens **in parallel** with Pillars 1-7 build. By the time Pillar 8 starts integration, the WA infra is ready.

### F.2 Schema patches to `whatsapp_messages` (Pillar 8 §3.6)

```typescript
// Add:
whatsappMessages.conversationId: text("conversation_id"),         // Meta's 24h conversation grouping
whatsappMessages.conversationCategory: text("conversation_category"),  // 'utility' | 'authentication' | 'marketing' | 'service' (Meta pricing categories)
whatsappMessages.businessInitiated: boolean("business_initiated").notNull().default(false),
whatsappMessages.businessScopedUserId: text("business_scoped_user_id"),  // BSUID — new Meta identifier (2026)
whatsappMessages.templateNameUsed: text("template_name_used"),    // for outbound templates
whatsappMessages.templateStatus: text("template_status"),         // 'sent' | 'delivered' | 'read' | 'failed'
whatsappMessages.deliveryFailureReason: text("delivery_failure_reason"),
```

### F.3 NEW — `unified_communications_view`

```sql
CREATE OR REPLACE VIEW unified_communications AS
SELECT
  'email'::text AS channel,
  em.id, em.thread_id::text AS thread_key,
  em.from_email AS from_addr, em.to_emails AS to_addrs,
  em.subject, em.body_text AS body,
  em.direction, em.sent_at,
  et.project_id, et.client_id, em.sent_by_profile_id AS sent_by
FROM email_messages em
LEFT JOIN email_threads et ON et.id = em.thread_id
UNION ALL
SELECT
  'whatsapp'::text,
  wm.id, wm.thread_key,
  wm.from_e164, ARRAY[wm.to_e164],
  NULL, wm.body_text,
  wm.direction, wm.received_at,
  wm.project_id, NULL, wm.matched_profile_id
FROM whatsapp_messages wm;
```

UI uses this view for the unified thread display. Each conversation card shows email + WhatsApp interleaved chronologically.

### F.4 Cross-channel anchoring

When a WhatsApp inbound matches a known contact:
1. Find the contact's most-recently-active email_thread (within last 30 days).
2. If a thread exists, set `whatsapp_messages.thread_key = "wa+email:" || email_thread_id`.
3. UI displays both under one conversation header.
4. AI memory chunk scope = same as the email_thread's project/client.

---

## G. Automation Gaps Closed (Pillar 11 extensions)

### G.1 Equipment conflict resolution workflow

When `equipment_reservations` btree_gist throws an exclusion exception (Pillar 6), the catch handler now:

1. Notifies the user attempting the second reservation: "هذا [equipment] محجوز للمشروع [X] في الفترة دي. الخيارات: (أ) شوف معدات مكافئة، (ب) أجل، (ج) تواصل مع [first_reserver]".
2. Triggers AI task `suggest-equipment-alternative`:
   - Looks at the requested equipment's `equipment_groups.code` + capabilities.
   - Finds available equipment in same/compatible group during the time window.
   - Surfaces top 3 alternatives.
3. One-tap apply alternative → new reservation row, original conflict closed.

Implemented as `alert_rules.key = 'equipment_conflict_alternative_suggest'` (event-triggered, no schedule).

### G.2 Auto-replan on date change

`alert_rules.key = 'project_date_change_replan'`:
- Triggered when `projects.shoot_starts_at` or `shoot_ends_at` updates.
- AI replan task: scans affected `equipment_reservations`, `project_assignments`, `calendar_event` — compiles a replan plan.
- Drafts notifications to crew + equipment_reservation owners.
- One-tap apply → cascade-update timestamps, regenerate calendar event, notify crew.

### G.3 Battery "Mark Charged" UI

Two paths:
1. **In-app button** on equipment detail (battery items): button "تم الشحن الآن" → sets `equipment.last_charged_at = now()` and inserts `equipment_activity_log` row.
2. **Quick action in WhatsApp**: Musa3ed gets a daily WhatsApp message listing stale batteries with reply commands. Replying with the battery code marks it charged.

`v_battery_alerts` from Pillar 6 stays. Daily alert collapses 20 stale batteries into ONE notification with a list (not 20 separate notifications).

### G.4 Pre-shoot checklist from project_learnings

Trigger.dev `task("pre-shoot-briefing")` runs 24h before each project's `shoot_starts_at`:
- Queries `project_learnings` for: client_id, location_id (if set), talent_id (if any), crew profiles.
- Builds a personalized briefing with the top 5 relevant learnings.
- Sends as morning email/WhatsApp to project_manager + DOP.

### G.5 Vendor onboarding packet workflow

```typescript
export const vendorPackets = pgTable("vendor_packets", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  status: text("status").notNull().default("requested"),    // 'requested', 'approved', 'sent', 'acknowledged'
  requestedById: uuid("requested_by_id").references(() => profiles.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),

  // What's in the packet
  documentsRequested: text("documents_requested").array(),  // ['cr', 'vat', 'national_address', 'bank_details', ...]
  documentsSent: text("documents_sent").array(),

  // Workflow
  approvedById: uuid("approved_by_id").references(() => profiles.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  sentEmailDraftId: uuid("sent_email_draft_id").references(() => emailDrafts.id),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  notes: text("notes"),
});
```

Flow: any team member triggers "Send vendor packet" on a contact → creates `vendor_packets` row → AM/admin approves → draft email created (Pillar 8) with attachments → on approve, email sent → client acknowledgement recorded.

### G.6 Inbound spam classifier (Pillar 10 patch)

Email-ingest task adds a pre-classification step BEFORE routing:
- Call Haiku 4.5 with the email subject + first 500 chars + sender domain.
- Returns: `{ category: 'business' | 'marketing' | 'platform_notification' | 'support_outreach' | 'spam', confidence }`.
- If category in (marketing, spam) with confidence > 0.8 → auto-archive (move to Gmail's existing `_Inbox/spam` label) → no leads created → optional weekly digest.
- Otherwise continue normal routing.

Massive noise reduction (30-50% of info@ per the recon).

---

## H. UX Spec Patches (Pillar 12 extensions)

### H.1 Cmd+K command registry spec

`packages/ui/src/cmdk/registry.ts`:

```typescript
export type Command = {
  key: string;                        // unique
  category: 'navigate' | 'create' | 'act' | 'search' | 'ai';
  label: { ar: string; en: string };
  shortcut?: string;                  // 'g p' for "go projects"
  scopeFilter?: (ctx: AppContext) => boolean;
  handler: (args: CmdArgs) => Promise<void>;
  permissionKey?: string;             // gates visibility
  iconKey?: string;
};

// Each feature pillar registers its own:
registry.register({ key: 'navigate.projects', category: 'navigate', label: { ar: 'افتح المشاريع', en: 'Open projects' }, shortcut: 'g p', handler: () => router.push('/app/projects') });
registry.register({ key: 'create.project', category: 'create', label: { ar: 'مشروع جديد', en: 'New project' }, shortcut: 'n p', permissionKey: 'project.create', handler: () => openDialog('new-project') });
// ... ~80 commands total
```

Fuzzy match: `cmdk` library default + custom Arabic normalizer (strip diacritics, normalize alif/yaa variants). AI suggestions appear with a `?` prefix or auto-promote when query starts with question word.

### H.2 Empty / Loading / Error states (one-pager per pillar)

For every page in Pillar 12 §7, define:
- **Empty state**: illustration + 1-line message + suggested action (button or link).
- **Skeleton**: 3-row table skeleton OR card skeleton, shimmer at 1.5s period.
- **Error state**: icon + brief message + retry button + contact-support link.

Stored as React components in `packages/ui/src/states/*.tsx`. Catalog in `/app/dev/states` for review.

### H.3 Mobile flows for critical actions

Three explicit mobile-first flows (PWA in `apps/web`):

1. **Attendance check-in** (`/check-in`):
   - Full-screen camera, single big "Capture" button.
   - PIN entry overlay if PIN required.
   - Result screen: "✓ موقعك سُجِّل في [Hara BMW] — الساعة [time]".

2. **Approve draft** (`/d/[id]`):
   - Mobile-optimized email preview.
   - Two big buttons: "اعتمد و ابعت" / "اعدّل".
   - Edit mode: standard textarea + send.

3. **Tasks today** (`/me/today`):
   - Card per task.
   - Swipe right = complete, swipe left = snooze.
   - Tap = open project context.

### H.4 In-app onboarding (per-user)

After first login:
- 4-step welcome modal (profile photo, language, notification preferences, capability self-declaration).
- Subsequent: contextual tooltips on first visit to each major page (dismissable).
- Profile completeness ring in sidebar header (gentle nudge).

### H.5 RTL/LTR details

- **Numbers**: Always **Western Arabic numerals (0-9)** even in Arabic text. Saudi convention. (NOT Hindu-Arabic ٠-٩.)
- **Dates**: Hijri secondary (e.g., "15 May 2026 / 27 ذو القعدة 1447") — togglable per user.
- **Tables**: cell direction follows content; code/numeric columns are LTR-aligned even in RTL layout.
- **Keyboard shortcuts**: Cmd+K opens center modal regardless of RTL/LTR.
- **Charts**: X-axis flows right-to-left in RTL mode; legends mirror.

### H.6 Power-user customization (schema-ready, Phase 2)

```typescript
export const userPreferences = pgTable("user_preferences", {
  profileId: uuid("profile_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  layoutConfig: jsonb("layout_config").notNull().default({}),
  densityMode: text("density_mode").notNull().default("comfortable"),  // 'comfortable' | 'dense' | 'compact'
  savedFiltersByView: jsonb("saved_filters_by_view").notNull().default({}),
  columnOrderByTable: jsonb("column_order_by_table").notNull().default({}),
  pinnedItems: jsonb("pinned_items").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Phase 1 reads defaults; Phase 2 lights up the customization UI.

---

## I. Drive Permission Management (Pillar 13 §3 patch)

When a project Drive folder is created (Pillar 13 §3.2), an additional task runs `drive-sync-permissions`:
- Add all current `project_assignments.profile_id` as editors.
- Add `account_manager_id`, `project_manager_id`, `production_manager_id` as editors.
- Optionally add `client.primary_contact email` as commenter (admin opt-in).
- When `project_assignments` changes → re-run sync (add/remove permissions).

Sharing links to client portal continue to use Antagna's `project_share_views`, NOT Drive's "anyone with the link" — to keep audit trail.

---

## J. Social OAuth Token Health (Pillar 7 patch)

Daily task `oauth-token-health`:
- For each `managed_accounts` row, attempt a lightweight read (e.g., `me.id` from Instagram Graph).
- If token invalid/expired: insert `notification_event_types.key = 'social.token_expired'` to `managed_account.owner_profile_id` (or fallback to admin).
- UI surfaces a "Reconnect [account]" banner.
- `managed_accounts.last_token_check_at` + `managed_accounts.token_status` columns added.

---

## K. Acceptance Checklist for the Hardening Patch

All of the following must be ticked in addition to the original 15 pillars' criteria:

- [ ] Trigger.dev `grep` clean: no leftover "Inngest" references in any pillar body.
- [ ] Pro tier confirmed in Trigger.dev account.
- [ ] Pillar 2 share_token column removed from `projects`; `project_share_views` is the only sharing surface.
- [ ] `fn_block_self_role_escalation` trigger present and tested.
- [ ] `talents`, `freelancers`, `locations`, `equipment_profiles` tables + RLS.
- [ ] `vendor_packets` table + workflow.
- [ ] `project_learnings`, `decision_outcomes`, `template_edit_patterns`, `state_transition_overrides` tables + RLS.
- [ ] `ai_memory_chunks` quality columns added; retrieval increments counter.
- [ ] WhatsApp Business Cloud API provisioned (parallel work; check by Week 3).
- [ ] `whatsapp_messages` schema patched with conversation_id, BSUID, template_status.
- [ ] `unified_communications` view created.
- [ ] `attendance_records` schema corrected (no face matching); selfie + GPS + PIN.
- [ ] Subject Rights endpoints implemented (`/app/me/privacy/*`).
- [ ] ZATCA fields added to `invoices`; XML generation library wired (submission integration can be Phase 1.5).
- [ ] Cmd+K registry has 50+ commands across 10 categories.
- [ ] Mobile flows for check-in, approve draft, tasks today implemented.
- [ ] Spam classifier integrated into email-ingest task; archive auto-fires.
- [ ] Drive permission sync task runs on assignment changes.
- [ ] OAuth token health daily check runs.
- [ ] Cascade fix: critical historical FKs use SET NULL.
- [ ] Canonical team table in this file matches `profiles` seed exactly.

---

## L. Open Decisions Mohammed Must Make This Week

1. **ZATCA**: call Hussein. Is Volt already issuing ZATCA-compliant invoices via a 3rd-party? If not, immediate intermediate solution + Antagna's Phase 1 build of full XML+submission.

2. **WhatsApp Business**: kick off Meta Business verification (CR + VAT documents). 1-2 weeks lead time.

3. **Subject Rights consent**: confirm user-facing copy for the privacy page (Mohammed reviews + signs off).

4. **Abu Luka's new email**: when will the Workspace mailbox be created? Until then his profile stays `active=false`.

5. **PDPL registration**: register Volt with National Data Governance Platform (handled by Mohammed + legal counsel, not blocking build but blocking GO-LIVE).

6. **Trigger.dev Pro tier**: confirm $25/mo OK to start; upgrade later if scale demands.

---

## N. Internal Approval Workflow on Deliverables (NEW — D-026)

Mohammed asked for a two-stage internal approval before client gets anything:

```
Creator finishes deliverable
        ↓
   Director (Abu Luka) reviews
        ↓                 ↘
   Approved              Revisions requested
        ↓                 ↓
   AM reviews         (back to Creator)
        ↓                 ↓
   Approved          Creator re-submits → back to Director
        ↓
   Client receives (via project_share_views / portal)
```

### N.1 Schema

```typescript
export const internalApprovalStageEnum = pgEnum("internal_approval_stage", [
  "director", "account_manager", "production_manager", "custom"
]);

export const internalApprovalStatusEnum = pgEnum("internal_approval_status", [
  "pending",                  // waiting for this reviewer
  "approved",
  "revisions_requested",
  "skipped",                  // admin chose to skip this stage for this item
  "auto_advanced"             // SLA expired, escalated forward
]);

export const internalApprovals = pgTable("internal_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Target (polymorphic-ish — start with deliverables, extend later if needed)
  deliverableId: uuid("deliverable_id").references(() => deliverables.id, { onDelete: "cascade" }),

  // Pipeline position
  stage: internalApprovalStageEnum("stage").notNull(),
  stageOrder: integer("stage_order").notNull(),               // 1 = director, 2 = AM (configurable)
  cycleNumber: integer("cycle_number").notNull().default(1),  // increments each time revisions kick the cycle back

  // Reviewer
  reviewerProfileId: uuid("reviewer_profile_id").notNull().references(() => profiles.id),

  // State
  status: internalApprovalStatusEnum("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

  // Content
  versionReviewed: integer("version_reviewed"),                // which version of deliverable was reviewed
  notes: text("notes"),
  revisionRequestText: text("revision_request_text"),         // detailed feedback if revisions requested
  revisionRequestPriority: text("revision_request_priority"),  // 'minor' | 'major' | 'blocking'

  // Auto-advance / SLA
  slaHours: integer("sla_hours"),                              // expected response time
  slaBreachedAt: timestamp("sla_breached_at", { withTimezone: true }),
  autoAdvancedById: uuid("auto_advanced_by_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byDeliverable: index("approvals_by_deliverable").on(t.deliverableId, t.cycleNumber, t.stageOrder),
}));
```

### N.2 Deliverables table addition

```typescript
// Pillar 2 §6.2 deliverables gets:
deliverables.requiresDirectorApproval: boolean("requires_director_approval").notNull().default(true),
deliverables.requiresAmApproval: boolean("requires_am_approval").notNull().default(true),
deliverables.currentApprovalStage: text("current_approval_stage"),  // derived: 'creator' | 'director' | 'am' | 'client_ready' | 'approved'
deliverables.currentCycle: integer("current_cycle").notNull().default(1),
```

Per-project (or per-deliverable type) the booleans can be turned off. Default: both stages required.

### N.3 Status state machine (extends deliverables enum from Pillar 2)

Replaces `deliverable_status`:

```
draft               (creator working)
   ↓ submit
pending_director    (Abu Luka has it)
   ↓ approve         ↓ revisions
pending_am          → revisions_director
   ↓ approve         ↓ creator re-uploads
client_ready        → pending_director (next cycle)
   ↓ release to portal
in_client_review
   ↓ approve         ↓ revisions
delivered           → revisions_client
   ↓                  ↓ creator re-uploads
delivered (terminal) → pending_director (or pending_am — based on config)
```

Cancel allowed from any non-terminal state.

### N.4 Functions / Triggers

```sql
-- When a creator submits a deliverable, auto-create the first internal_approval row
CREATE OR REPLACE FUNCTION fn_submit_deliverable_for_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_director_id uuid;
  v_am_id uuid;
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'submitted' THEN
    -- Find director (Abu Luka role = 'general_manager') and AM for this project
    SELECT id INTO v_director_id FROM profiles WHERE role = 'general_manager' AND active = true LIMIT 1;
    SELECT account_manager_id INTO v_am_id FROM projects WHERE id = NEW.project_id;

    IF NEW.requires_director_approval THEN
      INSERT INTO internal_approvals (deliverable_id, stage, stage_order, cycle_number, reviewer_profile_id, status, version_reviewed, sla_hours)
      VALUES (NEW.id, 'director', 1, NEW.current_cycle, v_director_id, 'pending', NEW.current_version_number, 24);

      UPDATE deliverables SET status = 'pending_director', current_approval_stage = 'director'
      WHERE id = NEW.id;

      -- Trigger notification (Pillar 11 handles)
      PERFORM pg_notify('deliverable_submitted_for_director', json_build_object('deliverable_id', NEW.id)::text);
    ELSIF NEW.requires_am_approval THEN
      -- Skip director, go to AM
      INSERT INTO internal_approvals (deliverable_id, stage, stage_order, cycle_number, reviewer_profile_id, status, version_reviewed, sla_hours)
      VALUES (NEW.id, 'account_manager', 1, NEW.current_cycle, v_am_id, 'pending', NEW.current_version_number, 24);

      UPDATE deliverables SET status = 'pending_am', current_approval_stage = 'am' WHERE id = NEW.id;
    ELSE
      UPDATE deliverables SET status = 'client_ready', current_approval_stage = 'client_ready' WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- When director approves → move to AM (or skip if not required)
CREATE OR REPLACE FUNCTION fn_advance_approval_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_deliverable deliverables%ROWTYPE;
  v_am_id uuid;
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    SELECT * INTO v_deliverable FROM deliverables WHERE id = NEW.deliverable_id;

    IF NEW.stage = 'director' THEN
      IF v_deliverable.requires_am_approval THEN
        SELECT account_manager_id INTO v_am_id FROM projects WHERE id = v_deliverable.project_id;
        INSERT INTO internal_approvals (deliverable_id, stage, stage_order, cycle_number, reviewer_profile_id, status, version_reviewed, sla_hours)
        VALUES (NEW.deliverable_id, 'account_manager', 2, v_deliverable.current_cycle, v_am_id, 'pending', v_deliverable.current_version_number, 24);

        UPDATE deliverables SET status = 'pending_am', current_approval_stage = 'am' WHERE id = NEW.deliverable_id;
      ELSE
        UPDATE deliverables SET status = 'client_ready', current_approval_stage = 'client_ready' WHERE id = NEW.deliverable_id;
      END IF;
    ELSIF NEW.stage = 'account_manager' THEN
      UPDATE deliverables SET status = 'client_ready', current_approval_stage = 'client_ready' WHERE id = NEW.deliverable_id;
    END IF;
  END IF;

  -- When revisions requested → back to creator
  IF NEW.status = 'revisions_requested' AND OLD.status = 'pending' THEN
    UPDATE deliverables SET status = 'revisions_director', current_approval_stage = 'creator'
    WHERE id = NEW.deliverable_id;

    -- Notify creator (Pillar 11 alert rule fires)
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER tg_advance_approval_chain AFTER UPDATE OF status ON internal_approvals
FOR EACH ROW EXECUTE FUNCTION fn_advance_approval_chain();

-- When creator re-uploads after revisions → start new cycle, back to director
CREATE OR REPLACE FUNCTION fn_resubmit_after_revisions() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_director_id uuid;
BEGIN
  IF OLD.status IN ('revisions_director', 'revisions_am') AND NEW.status = 'submitted' THEN
    UPDATE deliverables SET current_cycle = current_cycle + 1 WHERE id = NEW.id;
    SELECT id INTO v_director_id FROM profiles WHERE role = 'general_manager' AND active = true LIMIT 1;

    INSERT INTO internal_approvals (deliverable_id, stage, stage_order, cycle_number, reviewer_profile_id, status, version_reviewed, sla_hours)
    VALUES (NEW.id, 'director', 1, NEW.current_cycle, v_director_id, 'pending', NEW.current_version_number, 24);

    UPDATE deliverables SET status = 'pending_director', current_approval_stage = 'director' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
```

### N.5 New Alert Rules (Pillar 11 additions)

| Rule key | Trigger | Recipient | Escalation |
|----------|---------|-----------|------------|
| `deliverable_pending_director_24h` | SLA breach: pending_director > 24h | Director | +24h → admin |
| `deliverable_pending_am_24h` | SLA breach: pending_am > 24h | AM | +24h → PM |
| `deliverable_revisions_back_to_creator` | revisions_requested → creator | Creator | +48h → PM |
| `deliverable_cycle_over_3` | current_cycle > 3 | PM + admin | none — escalation IS the alert |
| `deliverable_approved_by_director` | director approval | AM + Creator | none |
| `deliverable_approved_by_am` | AM approval | Creator + PM | none |
| `deliverable_client_ready` | reaches client_ready | AM | none — AM's job is to push to client |

### N.6 UI Surfaces (Pillar 12 additions)

- **Deliverable detail page**: shows the full approval timeline (cycles, reviewers, decisions, notes).
- **Director's queue page** (`/app/director-review`): all `pending_director` deliverables ordered by submitted_at + SLA color (green / amber / red).
- **AM's queue page** (`/app/am-review`): all `pending_am` deliverables for projects where I'm the AM.
- **Creator's "needs revision" inbox** (`/app/me/revisions`): all deliverables sent back to me, with the revision notes prominent.
- **One-click actions** per reviewer:
  - ✓ Approve (with optional note)
  - ✎ Request revisions (with mandatory revisionRequestText + priority)
  - ⏭ Skip this stage (admin override only)

### N.7 Configuration

Per-project, in `projects` we add a `default_approval_flow` jsonb column:

```jsonb
{
  "director_required": true,
  "am_required": true,
  "director_sla_hours": 24,
  "am_sla_hours": 24,
  "auto_advance_on_sla_breach": false
}
```

When inserted, deliverables inherit this. Per-deliverable can override.

### N.8 Acceptance criteria

- [ ] `internal_approvals` table + RLS.
- [ ] Deliverable status enum extended; state machine trigger updated.
- [ ] Submit deliverable → director gets notification within 30s.
- [ ] Director approves → AM gets notification.
- [ ] AM approves → status becomes `client_ready`.
- [ ] Director requests revisions → creator gets notification with revision text.
- [ ] Creator re-uploads → cycle increments, back to director.
- [ ] SLA breach @ 24h pending → escalation notification fires.
- [ ] Cycle 4 reached → PM + admin notified.

---

## O. Dafterah (Finance) Integration — Lightweight Reference Pattern

D-022 says finance is OUT of Antagna Phase 1. Volt uses **Dafterah** (دفترة). Antagna keeps **references** only.

### O.1 Schema additions

```typescript
// projects table additions:
projects.dafterahQuoteNumber: text("dafterah_quote_number"),
projects.dafterahPoNumber: text("dafterah_po_number"),
projects.dafterahInvoiceNumber: text("dafterah_invoice_number"),
projects.dafterahNotes: text("dafterah_notes"),

// Existing attachments table (polymorphic, Pillar 2 §9.1) handles PDFs:
// — attachment row with entity_type='project', metadata.category='po' | 'invoice' | 'quote' | 'receipt'
```

### O.2 No invoice/quote tables actively used

`quotes`, `invoices`, `payments`, `quote_line_items`, `invoice_line_items` tables stay in the schema (from Pillar 2 §7) BUT:
- No UI in Phase 1
- No auto-generation
- No ZATCA submission
- No AR aging dashboards

If Mohammed later wants to bring finance in-house, the tables are ready. For now they sit dormant.

### O.3 UI changes (Pillar 12)

- Project detail page → "Finance" tab shows:
  - 3 inputs: Quote #, PO #, Invoice # (from Dafterah, manually entered)
  - Attachments grid filtered to category in (po, invoice, quote, receipt)
  - One-click "Upload PO PDF" / "Upload Invoice PDF"
- NO invoice creator UI.
- NO chase email rules tied to invoice age (those are in Pillar 11 — we DISABLE them for Phase 1).

### O.4 What gets removed from Pillar 11 alert rules

- `invoice_overdue_30d` — disabled (no invoices in our system).
- `invoice_overdue_60d` — disabled.
- `quote_expiring_3d` — disabled.

These remain in the schema for future activation.

---

## P. WhatsApp via Baileys (self-hosted) — Replaces Meta Cloud API

D-023 — use **Baileys** (open-source WhatsApp Web protocol library) on a self-hosted VPS instead of Meta Cloud API.

### P.1 Architecture

```
WhatsApp servers
       ↑↓ (WebSocket — unofficial protocol)
┌──────────────────────┐
│  whatsapp-gateway    │  ← apps/whatsapp-gateway (Node.js + Baileys)
│  VPS (Hetzner/STC)   │     dedicated Saudi number, multi-device session
└──────┬───────┬───────┘
       │       │
   inbound   outbound
   webhook   HTTP API
       │       ▲
       ▼       │
┌──────────────────────┐
│  Antagna             │
│  (Trigger.dev tasks  │
│  + REST endpoints)   │
└──────────────────────┘
```

### P.2 New service: `apps/whatsapp-gateway`

```
apps/whatsapp-gateway/
├── src/
│   ├── index.ts              # Express server
│   ├── baileys-client.ts     # WhatsApp connection + session persistence
│   ├── routes/
│   │   ├── send.ts           # POST /send-message
│   │   ├── status.ts         # GET /status (connection health)
│   │   └── qr.ts             # GET /qr (admin QR scan for re-auth)
│   └── lib/
│       ├── webhook.ts        # POST to Antagna on inbound
│       └── session-store.ts  # Stores Baileys auth state in Supabase Storage (encrypted)
├── Dockerfile
├── package.json
└── README.md
```

Deployed via Docker Compose on the VPS. Crashes auto-restart.

### P.3 Session persistence

Baileys stores its auth state (keys + session). Two options:
- **Filesystem**: simple but tied to the VPS — if VPS dies, session lost.
- **Supabase Storage (encrypted)**: portable, can fail over to another VPS.

Decision: **Supabase Storage** for resilience.

### P.4 HTTP API

```
POST /send-message
  Body: { to: "+9665XXXXXXXX", type: "text"|"image"|"document", body: "...", media_url?: "..." }
  Auth: Bearer token (shared secret)
  Returns: { message_id, status: 'queued' }

GET /status
  Returns: { connected: bool, last_message_at, queue_depth, qr_url? }

POST /send-template (for outbound, Phase 2 — keep route stubbed)

Webhook → Antagna
  POST {ANTAGNA_URL}/api/whatsapp/inbound
  Body: { from, body, type, media_url?, raw_payload, message_id, timestamp }
```

### P.5 Throttling & best practices to reduce ban risk

- Max 1 outbound message per 5 seconds (configurable).
- Don't broadcast to >10 recipients in a row.
- No marketing-style templates (use natural-sounding messages).
- Use a dedicated Saudi number (not Mohammed's personal).
- Warm up the number gradually (low volume first weeks).
- Random jitter on send time (200-800ms).
- Respect WhatsApp's "last seen" — don't send to numbers that haven't messaged the business in 24h unless they initiated.

### P.6 Reconnection logic

- On disconnect: retry with exponential backoff (1s → 60s).
- If 5 retries fail: trigger admin notification + QR re-scan needed.
- Persistent connection monitor: ping every 30s.

### P.7 Schema simplification

The Pillar 16 §F.2 additions (BSUID, conversation_category, template_status) are for Meta Cloud API. We DROP them. `whatsapp_messages` stays as Pillar 8 §3.6 defined (simpler).

```typescript
// whatsapp_messages — final shape (no Meta-specific fields):
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  baileysMessageId: text("baileys_message_id").unique(),
  direction: text("direction").notNull(),
  fromE164: text("from_e164").notNull(),
  toE164: text("to_e164").notNull(),
  matchedContactId: uuid("matched_contact_id").references(() => contacts.id),
  matchedProfileId: uuid("matched_profile_id").references(() => profiles.id),
  messageType: text("message_type"),
  bodyText: text("body_text"),
  mediaStoragePath: text("media_storage_path"),     // Supabase Storage path
  rawPayload: jsonb("raw_payload"),
  aiSummary: text("ai_summary"),
  aiClassification: text("ai_classification"),
  threadKey: text("thread_key"),
  projectId: uuid("project_id").references(() => projects.id),
  sentStatus: text("sent_status"),                  // 'queued', 'sent', 'delivered', 'read', 'failed' (best-effort tracking from Baileys events)
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### P.8 Hosting

- **Recommended VPS**: Hetzner CPX11 (Falkenstein, Germany) — €4.50/mo, plenty for 1-2 numbers + light AI orchestration.
- **Alternative KSA**: STC Cloud micro instance — higher cost but in-country.
- Decision: start with Hetzner; move to KSA if PDPL pressure increases.

### P.9 Acceptance

- [ ] `apps/whatsapp-gateway` skeleton exists, deploys to VPS via Docker.
- [ ] First QR scan via `/qr` endpoint completes login.
- [ ] Test send: `POST /send-message` from Trigger.dev → Mohammed's phone receives.
- [ ] Test receive: send WA message to gateway number → Antagna's `/api/whatsapp/inbound` gets the webhook → row appears in `whatsapp_messages`.
- [ ] Reconnection test: kill the gateway → restart → reconnects without re-scan (session persisted).
- [ ] Rate-limit test: 100 outbound queued → throttling holds at 1/5s.

---

## Q. Closing Note

Pillar 16 now also handles:
- D-022: Finance/ZATCA out (Dafterah handles)
- D-023: WhatsApp via Baileys (open source)
- D-024: Abu Luka — no special handling
- D-025: NDGP — not required
- D-026: Internal approval workflow

After all the patches, the Phase 1 scope is materially smaller and more focused. Antagna does NOT do finance, NOT submit to ZATCA, NOT integrate with Meta. It DOES handle the project lifecycle, CRM, deliverables (with the new approval pipeline), equipment, social media talents, attendance (selfie+PIN+GPS), and an AI memory + learning loop.

**Decision velocity:** Pillars 1-2 still the first sprint; Pillar 16's hardening items integrated into the relevant pillars' work. Code can start now.

— End of Hardening Patch.
