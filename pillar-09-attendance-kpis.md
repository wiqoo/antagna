# Pillar 9 — Attendance & KPIs

**Status:** Planning
**Depends on:** Pillars 1-5, 8
**Estimated effort:** 2-3 sessions

Two related features Mohammed asked for explicitly:
1. **Attendance** via selfie + GPS + timestamp (PWA). **No automated face-matching** — selfie is an audit-trail artifact only. This decision (taken 2026-05-14 after peer review) avoids PDPL "Sensitive Personal Data" classification of biometric embeddings, which would otherwise require KSA-resident storage + Saudi SCC templates + risk assessment + National Data Governance Platform registration.
2. **KPIs** derived from system events — never manual forms (lesson from 4 abandoned Drive folders).

---

## 1. Goals

- PWA-based check-in: opens camera, takes selfie, captures GPS + timestamp.
- Anti-spoof: face-match against stored reference photo, server-side timestamp, motion check.
- Auto-link to project when checking in at a shoot location.
- KPIs derived automatically from operational data — no manual input forms (except 1 end-of-project NPS).
- Per-role dashboards.

## 2. Success Criteria

1. Open `/check-in` on phone → camera opens → selfie + GPS captured in <10s → server records.
2. Server validates selfie face-match score >0.7 → accepted; <0.7 → flagged for manual review.
3. KPI dashboard shows real numbers populated from events with no manual entry.
4. Mohsen sees his personal KPI page: shoots completed, edits delivered on time, current load.
5. Late check-in (>30 min after expected start) → notification fires.

---

## 3. Attendance Schema

### 3.1 ~~`employee_reference_photos`~~ — REMOVED

We previously planned reference photos + face embeddings for automated verification. This is dropped per PDPL risk review (2026-05-14). The system uses:
- Optional **employee PIN** (4-6 digits, stored hashed in `employees.pin_hash`).
- Mandatory **selfie** (audit-trail only, no biometric extraction).
- Mandatory **GPS + server timestamp**.
- Anti-replay: hash check on the captured selfie within 24h.

If face-matching becomes truly necessary later, we re-evaluate with proper KSA-resident storage + SDAIA-approved SCCs + recorded explicit consent + retention policy.

```typescript
// Added to employees table (see Pillar 2 §3.2):
export const employeesPinHash = "ADD COLUMN pin_hash text"; // bcrypt hash
```

### 3.2 `attendance_records`

```typescript
export const attendanceTypeEnum = pgEnum("attendance_type", [
  "check_in_office", "check_out_office",
  "check_in_shoot", "check_out_shoot",
  "remote_start", "remote_end",
  "leave_start", "leave_end"
]);

export const attendanceVerificationEnum = pgEnum("attendance_verification", [
  "verified",
  "flagged_pin_failed",
  "flagged_location_mismatch",
  "flagged_replay_suspected",
  "flagged_clock_skew",
  "manually_overridden"
]);

export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  type: attendanceTypeEnum("type").notNull(),

  // Selfie (audit trail only — no automated face matching)
  selfieUrl: text("selfie_url").notNull(),
  selfieHash: text("selfie_hash"),                          // for replay-attack detection within 24h
  pinVerified: boolean("pin_verified").notNull().default(false),

  // Location
  gpsLat: numeric("gps_lat", { precision: 10, scale: 7 }),
  gpsLng: numeric("gps_lng", { precision: 10, scale: 7 }),
  gpsAccuracyMeters: numeric("gps_accuracy_meters", { precision: 8, scale: 2 }),
  resolvedLocationLabel: text("resolved_location_label"),  // 'Office - Jeddah', 'Shoot - Hara BMW', etc.
  geoFenceId: uuid("geo_fence_id"),                         // optional FK to known locations

  // Time
  clientTimestamp: timestamp("client_timestamp", { withTimezone: true }),
  serverTimestamp: timestamp("server_timestamp", { withTimezone: true }).notNull().defaultNow(),
  timeDeltaMs: integer("time_delta_ms"),

  // Context
  associatedProjectId: uuid("associated_project_id").references(() => projects.id),
  associatedCalendarEventId: text("associated_calendar_event_id"),

  // Outcome
  verification: attendanceVerificationEnum("verification").notNull(),
  overrideByProfileId: uuid("override_by_profile_id").references(() => profiles.id),
  overrideReason: text("override_reason"),

  // Device
  deviceInfo: jsonb("device_info"),                         // user-agent, platform, etc.

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.3 `geo_fences` (known locations)

```typescript
export const geoFences = pgTable("geo_fences", {
  id: uuid("id").primaryKey().defaultRandom(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  centerLat: numeric("center_lat", { precision: 10, scale: 7 }).notNull(),
  centerLng: numeric("center_lng", { precision: 10, scale: 7 }).notNull(),
  radiusMeters: integer("radius_meters").notNull().default(100),
  kind: text("kind").notNull(),                              // 'office', 'studio', 'recurring_client_site'
  clientId: uuid("client_id").references(() => clients.id), // when location is a client site
  active: boolean("active").notNull().default(true),
});
```

Seed: Volt office Jeddah, common client locations (Hara BMW showroom, MYNM HQ, etc.) added over time.

---

## 4. The PWA Check-in Flow

`/check-in` route (auth required):

```
1. UI requests camera + geolocation.
2. Live preview + reticle. User taps "Capture".
3. Selfie + GPS sent to /api/attendance/check-in.
4. Server (Trigger.dev task "attendance-verify"):
   a. Download selfie, run face-detection.
   b. Generate face embedding via a small model (e.g., DeepFace served via Replicate or local).
   c. Compute cosine similarity vs reference photo.
   d. Reverse-geocode GPS to find nearest geo_fence.
   e. Look up active shoot calendar events at that location/time.
   f. Insert attendance_records with verification verdict.
   g. If `flagged_*`, notify HR (Turky).
5. UI shows confirmation + auto-detected location + auto-linked project.
```

### 4.1 Anti-spoof signals

| Signal | Treatment |
|--------|-----------|
| `face_match_score < 0.7` | flagged_low_match |
| no face detected | flagged_no_match |
| `gps_accuracy_meters > 500` | flagged_location_mismatch (low confidence) |
| no geo_fence within 200m | flagged_location_mismatch |
| `time_delta_ms > 5 min` (client vs server) | flagged_low_match (clock manipulation) |
| Same selfie hash as previous within 24h | flagged_low_match (replay) |

---

## 5. KPI Schema

KPIs are derived. We only need 2 storage tables:

### 5.1 `kpi_definitions` (catalog)

```typescript
export const kpiDefinitions = pgTable("kpi_definitions", {
  key: text("key").primaryKey(),                            // 'projects_delivered_on_time_pct'
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  scope: text("scope").notNull(),                            // 'person' | 'project' | 'client' | 'company'
  unit: text("unit").notNull(),                              // 'count', 'pct', 'sar', 'days'
  computeSql: text("compute_sql"),                           // optional: SQL to compute (parameterized)
  thresholdGreen: numeric("threshold_green", { precision: 12, scale: 4 }),
  thresholdAmber: numeric("threshold_amber", { precision: 12, scale: 4 }),
  refreshFrequency: text("refresh_frequency").notNull(),     // 'realtime' | 'hourly' | 'daily' | 'weekly'
  active: boolean("active").notNull().default(true),
});
```

### 5.2 `kpi_snapshots` (time-series)

```typescript
export const kpiSnapshots = pgTable("kpi_snapshots", {
  id: bigserial("id").primaryKey(),
  kpiKey: text("kpi_key").notNull().references(() => kpiDefinitions.key),
  scopeEntityType: text("scope_entity_type"),               // 'profile' | 'project' | 'client' | null (company-wide)
  scopeEntityId: uuid("scope_entity_id"),
  periodStart: text("period_start").notNull(),              // 'YYYY-MM-DD'
  periodEnd: text("period_end").notNull(),
  value: numeric("value", { precision: 14, scale: 4 }).notNull(),
  metadata: jsonb("metadata"),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueSnapshot: unique().on(t.kpiKey, t.scopeEntityType, t.scopeEntityId, t.periodStart),
  byKpiTime: index("kpi_by_time").on(t.kpiKey, t.computedAt.desc()),
}));
```

### 5.3 Initial KPI Catalog (seeded)

**Person scope:**
- `attendance_present_pct` — daily/weekly/monthly
- `shoots_completed_count` — per period
- `edits_delivered_on_time_pct`
- `tasks_completed_count`
- `tasks_overdue_count`
- `avg_response_time_hours_to_assignment`
- `client_compliments_count` (derived from email AI tagging)
- `client_complaints_count`

**Project scope:**
- `days_brief_to_quote`
- `days_quote_to_award`
- `revision_rounds_count`
- `on_time_delivery_bool`
- `profit_margin_pct` (when finance is on)
- `team_size_count`

**Client scope:**
- `revenue_last_12mo_sar`
- `projects_count_last_12mo`
- `avg_payment_days`
- `repeat_rate` (% of projects within 90 days of previous)
- `nps_avg`

**Company scope:**
- `monthly_active_projects`
- `monthly_revenue_sar`
- `pipeline_value_sar`
- `team_utilization_pct`
- `top_client_concentration_pct`

### 5.4 Refresh strategy

| Frequency | Mechanism |
|-----------|-----------|
| `realtime` | Trigger on entity change re-computes single KPI |
| `hourly` | pg_cron @ :05 of every hour |
| `daily` | pg_cron @ 03:00 Riyadh |
| `weekly` | pg_cron @ Sunday 04:00 |

The compute logic lives in `apps/worker/src/trigger/kpi-compute.ts`. Each KPI has a `computeFn(scopeEntityId, periodStart, periodEnd) → number` exported.

### 5.5 The one MANUAL KPI: end-of-project NPS

When a project moves to `delivered`, a Trigger.dev task waits 24h then sends the client a single-question survey:

> "How likely are you to recommend Volt for similar work? (0-10)"

Response stored in `kpi_snapshots` as `nps_score` for that project+client.

---

## 6. Dashboards (per role; built in Pillar 12)

| Role | Dashboard tiles |
|------|----------------|
| Admin (Mohammed) | Monthly revenue, pipeline value, top clients, team utilization, AR aging |
| Account Manager (Mansoury) | Pipeline by stage, lead conversion %, client follow-up due, AR per client |
| Project Manager (Khaled) | Active projects by stage, overdue tasks, revisions in progress, on-time delivery |
| Production Manager (Mohammed Ghareeb) | Today's shoots, this week's edits, crew availability, equipment conflicts |
| Equipment Manager (Musa3ed) | Bookings today/week, late returns, items in repair, battery alerts |
| Procurement (Kabsy) | Pending purchase orders, monthly spend, supplier delivery times |
| HR (Turky) | Attendance today, late check-ins, flagged-verification queue |
| Accountant (Hussein) | AR aging, invoices issued this month, payments due, ZATCA submissions |
| Individual (Mohsen / Hamada / Ahmed) | My shoots, my edits, my tasks, attendance streak |

---

## 7. Acceptance Checklist

- [ ] `attendance_records`, `geo_fences`, `employee_reference_photos`, `kpi_definitions`, `kpi_snapshots` tables + RLS.
- [ ] Seed: ~25 KPI definitions per §5.3, ~3 geo_fences (office + 2 common shoot sites).
- [ ] Reference photo upload for 1 test employee.
- [ ] PWA check-in works on Chrome mobile: camera, GPS, submit, server response.
- [ ] Face-match service integrated; score recorded; threshold logic correct.
- [ ] Geo-fence test: check-in at office coordinates → resolved location label correct.
- [ ] Replay attack test: same selfie hash within 24h → flagged.
- [ ] KPI compute test: insert test events → run KPI compute → snapshot row appears with expected value.
- [ ] Personal dashboard for Mohsen renders 6 tiles with real data.

---

## 8. Deferred

- **HR module proper** (leave management, payroll) → Phase 2.
- **Detailed analytics dashboards UI** → Pillar 12.
- **NPS survey UI** → Pillar 12.
- **Face-match model choice** (Replicate vs self-host) → Pillar 14.

---

## 9. Next: Pillar 10 — AI & Memory Layer
