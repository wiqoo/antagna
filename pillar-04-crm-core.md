# Pillar 4 — CRM Core

**Status:** Planning
**Depends on:** Pillars 1, 2, 3
**Estimated effort:** 2-3 sessions

The CRM is more than contacts in a database. It's the layer that solves the **shared-inbox identity crisis** Volt has today, surfaces lead pipeline visibility, and turns every interaction into structured knowledge.

---

## 1. Goals

- A unified CRM view: client → brands → projects → contacts → communication history.
- **Identity routing**: inbound email arrives at `info@voltsaudi.com` → system identifies the contact + matches to client → routes to the responsible Volt team member.
- **Lead pipeline**: not every email is a project; some are leads needing nurture.
- **Communication history** per contact (cross-channel: email + WhatsApp + meetings).
- **Repeat-business intelligence**: who comes back, how often, profitability.

## 2. Success Criteria

1. Inbound email from a known contact auto-matches and surfaces the right Volt team member.
2. Inbound from an unknown contact creates a "potential lead" card for triage.
3. Lead → Project conversion is one click and preserves all email history.
4. Client overview page shows: revenue trend, project count, average payment days, active threads, top contacts.
5. Merge-client function (admin-only) consolidates duplicates.
6. The 30 active clients from the legacy import are visible with full history.

---

## 3. Schema Additions (beyond Pillar 2)

### 3.1 `leads` (pre-project funnel)

A lead is an inbound interest that hasn't become a project yet.

```typescript
export const leadStatusEnum = pgEnum("lead_status", [
  "new", "qualified", "nurturing", "proposal_sent", "won", "lost", "ghosted"
]);

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                    // 'LEAD-0001'
  source: text("source"),                                   // 'email_inbound', 'referral', 'cold_outreach', 'social', 'event'
  sourceDetail: text("source_detail"),                      // free-form
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),

  // Inbound anchor
  inboundEmailMessageId: text("inbound_email_message_id"),  // gmail message id
  inboundThreadId: text("inbound_thread_id"),

  // Counterpart (may be unknown initially)
  clientId: uuid("client_id").references(() => clients.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  unmatchedFromEmail: text("unmatched_from_email"),         // when contact doesn't exist yet
  unmatchedFromName: text("unmatched_from_name"),

  status: leadStatusEnum("status").notNull().default("new"),
  estimatedValueSar: numeric("estimated_value_sar", { precision: 12, scale: 2 }),
  temperatureScore: integer("temperature_score"),           // 0-100, AI-derived

  // AI summary of the inbound
  aiSummary: text("ai_summary"),
  aiSuggestedAction: text("ai_suggested_action"),
  aiAnalyzedAt: timestamp("ai_analyzed_at", { withTimezone: true }),

  // Outcome
  convertedToProjectId: uuid("converted_to_project_id").references(() => projects.id),
  lostReason: text("lost_reason"),
  lostAt: timestamp("lost_at", { withTimezone: true }),

  // Assignment
  assignedToProfileId: uuid("assigned_to_profile_id").references(() => profiles.id),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.2 `client_assignments` (which Volt person owns this client relationship)

```typescript
export const clientAssignments = pgTable("client_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  role: text("role").notNull(),                             // 'primary_am', 'secondary_am', 'pm_alias', 'observer'
  active: boolean("active").notNull().default(true),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (t) => ({
  uniquePrimary: uniqueIndex("client_one_primary_am").on(t.clientId).where(sql`role = 'primary_am' AND active = true`),
}));
```

The unique index ensures **one and only one** primary AM per client at a time.

### 3.3 `client_health_snapshots` (derived metrics, refreshed nightly by pg_cron)

```typescript
export const clientHealthSnapshots = pgTable("client_health_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  snapshotDate: text("snapshot_date").notNull(),            // YYYY-MM-DD
  totalRevenueSar: numeric("total_revenue_sar", { precision: 14, scale: 2 }),
  totalProjectsCount: integer("total_projects_count"),
  activeProjectsCount: integer("active_projects_count"),
  lostProjectsCount: integer("lost_projects_count"),
  averagePaymentDays: integer("average_payment_days"),
  outstandingArSar: numeric("outstanding_ar_sar", { precision: 14, scale: 2 }),
  lastProjectAt: timestamp("last_project_at", { withTimezone: true }),
  daysSinceLastProject: integer("days_since_last_project"),
  retainerStatus: text("retainer_status"),                  // 'active', 'lapsed', 'never'
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueDaily: unique().on(t.clientId, t.snapshotDate),
}));
```

### 3.4 `inbound_email_routes` (the routing rule engine)

```typescript
export const inboundEmailRoutes = pgTable("inbound_email_routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  position: integer("position").notNull().default(0),       // priority order

  // Match conditions (any combination, all must match)
  matchFromContains: text("match_from_contains"),
  matchToContains: text("match_to_contains"),
  matchSubjectRegex: text("match_subject_regex"),
  matchDomain: text("match_domain"),                        // 'edelman.com'

  // Actions
  assignToProfileId: uuid("assign_to_profile_id").references(() => profiles.id),
  setLabelKey: text("set_label_key"),
  setStatus: text("set_status"),
  createLeadIfNew: boolean("create_lead_if_new").notNull().default(true),
  notifyChannel: text("notify_channel"),                    // 'email', 'whatsapp', 'in_app', 'all'

  active: boolean("active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Sample seed (based on Volt's reality):

| match_domain | assign_to | description |
|---|---|---|
| `auto.mynaghi.com` | manoury_id | MYNM brand emails → Mansoury |
| `bpggroup.com` | manoury_id | BPG agency → Mansoury |
| `edelman.com` | manoury_id | Edelman agency → Mansoury |
| `hrmny.co` | khalid_id | HRMNY → Khaled |
| `alfuttaim.com` | manoury_id | Al-Futtaim direct → Mansoury |
| `digitect.com` | manoury_id | Digitect agency → Mansoury |
| `smartestmedia.com` | manoury_id | Smartest Media → Mansoury |

---

## 4. Email-In Identity Resolution

When a new inbound email arrives (Pillar 8 wires Gmail), the resolver runs (Trigger.dev task):

```
Step 1 — Look up contact by `from` email in contact_methods (normalized).
  - If FOUND → client, contact, primary AM determined → route accordingly.
  - If NOT FOUND → step 2.

Step 2 — Look up domain in clients (by website or contacts).
  - If FOUND → likely a new contact at existing client.
    - Auto-create contact row (parsed from email signature via AI).
    - Route per client's primary AM.
  - If NOT FOUND → step 3.

Step 3 — New lead path.
  - Apply inbound_email_routes (in position order) — first match wins.
  - If no rule matches → leads.assigned_to_profile_id = default_inbox_owner (Mansoury).
  - Create `leads` row with status='new', AI-summarize the inbound.
  - Notify assignee.
```

The resolver is in `packages/ai/src/email-resolver.ts` and called by the Trigger.dev task `email-ingest`.

---

## 5. Lead → Project Conversion

UI: lead detail page has "Convert to Project" button.

Server action:
```typescript
// apps/web/src/app/app/leads/[id]/convert/route.ts
export async function POST(req: Request, { params }: Args) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, params.id) });
  if (!await currentUserHasPermission("project.create")) throw new Error("no permission");

  const project = await db.transaction(async (tx) => {
    const p = await tx.insert(projects).values({
      clientId: lead.clientId,
      title: lead.aiSummary || "New project from lead " + lead.code,
      stage: "brief",
      briefReceivedAt: lead.receivedAt,
      accountManagerId: lead.assignedToProfileId,
      createdBy: currentProfileId(),
    }).returning();
    // Migrate email anchor → project's first brief
    await tx.insert(briefs).values({
      projectId: p[0].id,
      version: 1,
      receivedAt: lead.receivedAt,
      receivedVia: 'email',
      sourceEmailMessageId: lead.inboundEmailMessageId,
      parsedSummary: lead.aiSummary,
    });
    // Mark lead as converted
    await tx.update(leads).set({ status: 'won', convertedToProjectId: p[0].id }).where(eq(leads.id, lead.id));
    return p[0];
  });

  return Response.json({ projectId: project.id });
}
```

---

## 6. Triggers & Scheduled Jobs

```sql
-- Auto-generate lead code
CREATE SEQUENCE IF NOT EXISTS lead_code_seq START 1;
CREATE OR REPLACE FUNCTION fn_next_lead_code() RETURNS text LANGUAGE sql AS $$
  SELECT 'LEAD-' || LPAD(nextval('lead_code_seq')::text, 4, '0');
$$;
ALTER TABLE leads ALTER COLUMN code SET DEFAULT fn_next_lead_code();

-- Nightly: refresh client_health_snapshots
SELECT cron.schedule(
  'refresh-client-health',
  '0 2 * * *',
  $$
    INSERT INTO client_health_snapshots (client_id, snapshot_date, total_revenue_sar, total_projects_count, ...)
    SELECT
      c.id,
      to_char(now(), 'YYYY-MM-DD'),
      COALESCE(SUM(i.total_sar), 0),
      COUNT(DISTINCT p.id),
      ...
    FROM clients c
    LEFT JOIN projects p ON p.client_id = c.id
    LEFT JOIN invoices i ON i.client_id = c.id AND i.status = 'paid'
    GROUP BY c.id
    ON CONFLICT (client_id, snapshot_date) DO UPDATE SET
      total_revenue_sar = EXCLUDED.total_revenue_sar,
      ...
  $$
);

-- Lead "ghosted" detection — if status = 'qualified' or 'proposal_sent' for >14 days with no activity, flag.
SELECT cron.schedule(
  'flag-ghosted-leads',
  '0 9 * * *',  -- daily 9am Riyadh
  $$
    UPDATE leads SET status = 'ghosted'
    WHERE status IN ('qualified', 'proposal_sent')
      AND updated_at < now() - interval '14 days';
  $$
);
```

---

## 7. UI Surfaces (designed in Pillar 12)

- **CRM Home**: split view — left column "Leads (12)", right column "Active Clients (37)". Cards show stage + last activity.
- **Client detail page**: header (name + logo + primary AM), tabs for Projects, Contacts, Communications, Health, Custom Fields.
- **Lead detail page**: original email, AI summary, suggested action buttons (Convert / Reject / Snooze / Reassign).
- **Inbound triage queue**: where unrouted/uncertain emails land for manual handling.

---

## 8. Acceptance Checklist

- [ ] `leads`, `client_assignments`, `client_health_snapshots`, `inbound_email_routes` tables created + RLS.
- [ ] Lead code auto-generation works.
- [ ] Inbound routing test: mock 5 emails (one from each known domain) → all route correctly.
- [ ] Inbound routing fallback: unknown domain → creates lead with default assignee.
- [ ] AI summary on lead populates within 30s of creation.
- [ ] Lead → Project conversion preserves email thread anchor.
- [ ] Merge clients function consolidates 2 test duplicates without data loss.
- [ ] Nightly health snapshot job populates `client_health_snapshots` for all clients.
- [ ] Ghosted-lead flag fires correctly after 14 days inactive.

---

## 9. Deferred to Other Pillars

- **Email parsing details** (Gmail API, Pub/Sub watch, attachment ingestion) → Pillar 8.
- **AI summary prompt + model selection** → Pillar 10.
- **CRM UI surfaces** → Pillar 12.
- **Lead-to-project automations beyond manual** → Pillar 11.
- **Client portal (share_token surface)** → Pillar 8.

---

## 10. Next: Pillar 5 — Project Lifecycle

The 11-stage flow, state machine enforcement, deliverables review pattern, auto-advance triggers, share-token portal scaffold.
