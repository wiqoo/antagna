# Pillar 8 — Communications Layer

**Status:** Planning
**Depends on:** Pillars 1-5, 10
**Estimated effort:** 3-4 sessions (one of the most substantial pillars)

The most user-visible "always-on" surface. Wire Gmail (real-time via Pub/Sub), unify inbound threads with project/lead context, build draft→review→send workflow, integrate Gemini meeting notes. WhatsApp deferred to Phase 2 but schema-ready.

---

## 1. Goals

- Real-time inbound email via Gmail Pub/Sub (not polling — 80-90% more efficient per research).
- Every inbound email lands as a structured `email_messages` row with AI parsing.
- Threads automatically link to project/lead/client.
- Draft → internal review → send pattern (matches Volt's current workflow).
- Templated emails: chase, quote cover, vendor onboarding, acknowledgement, follow-up.
- Per-user named-sender aliases (Mohammed sends as `ghareib@`, Mansoury as `mansoury@`, all logged centrally).
- Meeting notes from Gemini auto-imported and linked to project.
- WhatsApp Phase 2 schema ready.

## 2. Success Criteria

1. Inbound email arrives at `info@voltsaudi.com` → within 5s appears in Antagna's UI with AI summary.
2. Routing rules from Pillar 4 fire → assigned to correct Volt team member.
3. Draft a "chase invoice" email → reviewer approves → email goes out from `mansouri@voltsaudi.com` → recorded in central thread.
4. Gemini meeting note arrives → linked to project if subject contains project code → activity event posted.
5. Send email via templated chase action → 4 clicks: project → invoice → chase template → confirm.

---

## 3. Schema

### 3.1 `email_threads`

```typescript
export const emailThreads = pgTable("email_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  gmailThreadId: text("gmail_thread_id").notNull().unique(),
  subject: text("subject"),

  // Anchoring (denormalized for fast filtering)
  projectId: uuid("project_id").references(() => projects.id),
  leadId: uuid("lead_id").references(() => leads.id),
  clientId: uuid("client_id").references(() => clients.id),
  primaryContactId: uuid("primary_contact_id").references(() => contacts.id),

  // Routing
  assignedProfileId: uuid("assigned_profile_id").references(() => profiles.id),
  status: text("status").notNull().default("open"),         // 'open' | 'in_progress' | 'waiting_client' | 'closed' | 'spam'

  // Counters (maintained by trigger)
  messageCount: integer("message_count").notNull().default(0),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
  lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),

  // AI
  aiSummary: text("ai_summary"),
  aiSummaryUpdatedAt: timestamp("ai_summary_updated_at", { withTimezone: true }),
  aiTopicTags: text("ai_topic_tags").array(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.2 `email_messages`

```typescript
export const emailDirectionEnum = pgEnum("email_direction", ["inbound", "outbound", "internal"]);

export const emailMessages = pgTable("email_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => emailThreads.id, { onDelete: "cascade" }),
  gmailMessageId: text("gmail_message_id").unique(),
  internetMessageId: text("internet_message_id"),           // RFC822 Message-ID
  inReplyTo: text("in_reply_to"),

  direction: emailDirectionEnum("direction").notNull(),

  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmails: text("to_emails").array().notNull(),
  ccEmails: text("cc_emails").array(),
  bccEmails: text("bcc_emails").array(),

  subject: text("subject"),
  bodyHtml: text("body_html"),
  bodyText: text("body_text"),
  snippet: text("snippet"),

  // Attachments (denormalized count; full list in attachments table polymorphically)
  attachmentCount: integer("attachment_count").notNull().default(0),

  // Sender attribution for outbound
  sentByProfileId: uuid("sent_by_profile_id").references(() => profiles.id),
  actingAsProfileId: uuid("acting_as_profile_id").references(() => profiles.id),

  // AI per-message
  aiSummary: text("ai_summary"),
  aiSuggestedActions: jsonb("ai_suggested_actions"),

  sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byThread: index("messages_by_thread").on(t.threadId, t.sentAt.desc()),
}));
```

### 3.3 `email_drafts`

```typescript
export const emailDraftStatusEnum = pgEnum("email_draft_status", [
  "draft", "awaiting_review", "approved", "queued", "sent", "failed", "cancelled"
]);

export const emailDrafts = pgTable("email_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Context
  threadId: uuid("thread_id").references(() => emailThreads.id),
  projectId: uuid("project_id").references(() => projects.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  templateKey: text("template_key").references(() => emailTemplates.key),

  // Sender / recipient
  authorProfileId: uuid("author_profile_id").notNull().references(() => profiles.id),
  actingAsProfileId: uuid("acting_as_profile_id").references(() => profiles.id),
  sendFromAlias: text("send_from_alias").notNull(),         // 'mansoury@voltsaudi.com' or 'info@voltsaudi.com'

  toEmails: text("to_emails").array().notNull(),
  ccEmails: text("cc_emails").array(),
  bccEmails: text("bcc_emails").array(),

  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),

  // Review workflow
  status: emailDraftStatusEnum("status").notNull().default("draft"),
  approverProfileId: uuid("approver_profile_id").references(() => profiles.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),

  // Send outcome
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentMessageId: text("sent_message_id"),
  sendError: text("send_error"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.4 `email_templates`

```typescript
export const emailTemplates = pgTable("email_templates", {
  key: text("key").primaryKey(),                            // 'chase_30d', 'quote_cover', 'vendor_onboarding', 'acknowledgement_ar', 'acknowledgement_en'
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  category: text("category"),                                // 'chase', 'sales', 'admin', 'follow_up'
  subjectTemplate: text("subject_template").notNull(),       // with {{var}} placeholders
  bodyTemplate: text("body_template").notNull(),
  requiredVariables: text("required_variables").array(),     // ['client_name', 'amount_sar', 'invoice_number']
  requiresReview: boolean("requires_review").notNull().default(false),
  active: boolean("active").notNull().default(true),
});
```

Seed (verbatim from Volt's observed patterns):

```
chase_30d:
  subject: "Reminder — Invoice {{invoice_code}} – {{client_name}}"
  body: "Dear {{contact_name}}, I hope you are doing well. This is a kind reminder regarding the outstanding amount of SAR {{amount_sar}} for invoice {{invoice_code}}, which has exceeded the agreed payment terms. We kindly request your prompt processing of the payment. Best Regards, Volt Production Team"

quote_cover:
  subject: "Quotation — {{project_title}}"
  body: "Dear {{contact_name}}, Kindly find attached the quotation for your kind review. Please let me know if you need any additional information. Looking forward to your feedback. Best Regards, Abdullah A. Mansouri, Account Manager VOLT PRODUCTION TEAM"

acknowledgement_en:
  subject: "Re: {{original_subject}}"
  body: "Hi {{contact_name}}, Your email is well received. I will review with my team and get back to you shortly. Thank you. Best Regards, Volt Production Team"

vendor_onboarding:
  subject: "Volt Production — CR + VAT + National Address"
  body: "Dear {{contact_name}}, Please find attached our company documents for your vendor onboarding..."
```

### 3.5 `gmail_watch` (manages Pub/Sub subscription)

```typescript
export const gmailWatch = pgTable("gmail_watch", {
  id: uuid("id").primaryKey().defaultRandom(),
  mailbox: text("mailbox").notNull().unique(),              // 'info@voltsaudi.com'
  historyId: text("history_id"),                            // last processed history id
  watchExpiresAt: timestamp("watch_expires_at", { withTimezone: true }),
  lastRenewedAt: timestamp("last_renewed_at", { withTimezone: true }),
  pubsubTopic: text("pubsub_topic"),
  active: boolean("active").notNull().default(true),
});
```

### 3.6 WhatsApp (Phase 2 — schema ready, no integration yet)

```typescript
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  metaMessageId: text("meta_message_id").unique(),
  direction: text("direction").notNull(),                   // 'inbound' | 'outbound'
  fromE164: text("from_e164").notNull(),
  toE164: text("to_e164").notNull(),
  matchedContactId: uuid("matched_contact_id").references(() => contacts.id),
  matchedProfileId: uuid("matched_profile_id").references(() => profiles.id),
  messageType: text("message_type"),                        // 'text' | 'image' | 'video' | 'audio' | 'document'
  bodyText: text("body_text"),
  mediaUrl: text("media_url"),
  rawPayload: jsonb("raw_payload"),
  aiSummary: text("ai_summary"),
  aiClassification: text("ai_classification"),
  threadKey: text("thread_key"),                            // derived: contact_id or e164
  projectId: uuid("project_id").references(() => projects.id),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.7 `meeting_notes`

```typescript
export const meetingNotes = pgTable("meeting_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),                         // 'gemini', 'manual', 'transcription_other'
  sourceId: text("source_id"),
  meetingTitle: text("meeting_title"),
  meetingDate: timestamp("meeting_date", { withTimezone: true }),
  attendeesText: text("attendees_text"),
  noteContent: text("note_content"),
  driveUrl: text("drive_url"),
  projectId: uuid("project_id").references(() => projects.id),
  clientId: uuid("client_id").references(() => clients.id),
  aiActionItems: jsonb("ai_action_items"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 4. Gmail Pub/Sub Pipeline

### 4.1 Architecture

```
Gmail → Pub/Sub topic → Vercel webhook (lightweight, < 30s ack)
                                    │
                                    ▼
                          Trigger.dev task "email-ingest"
                                    │
                  ┌─────────────────┼──────────────────┐
                  ▼                 ▼                  ▼
          history.list      parse new msgs       update history_id
                                    │
                                    ▼
                  Resolve contact / project / lead
                                    │
                                    ▼
                  Insert email_threads + email_messages
                                    │
                                    ▼
            Trigger.dev task "ai-summarize-thread"
                                    │
                                    ▼
              Notify assignee (per email_routing_rules)
                                    │
                                    ▼
              Memory builder: chunk + embed + store
```

### 4.2 Watch renewal

`task("gmail-watch-renew", schedules.cron("0 2 * * *"))` — daily 2am Riyadh.
- For each `gmail_watch` row, if `watchExpiresAt < now() + 24h`, call `users.watch` to renew.

### 4.3 Send

Sending from named aliases uses Gmail's "send-as" feature (configured in Workspace admin once per alias). All sends go through `apps/worker/src/trigger/email-send.ts` which:
1. Checks `email_drafts.status = 'approved'`.
2. Submits to Gmail API.
3. Records `sent_message_id` and updates status to `sent`.

---

## 5. Templated Sends

Server action `sendTemplatedEmail({ template_key, context, requires_review })`:
1. Loads template, substitutes vars.
2. Inserts `email_drafts` with status:
   - `awaiting_review` if `requires_review = true` (e.g., quote cover, sensitive chase).
   - `queued` if not (e.g., acknowledgement, internal updates).
3. If `queued`, Trigger.dev sends immediately.
4. Returns draft ID.

The shortcut "Send chase email" on an invoice card builds context auto from invoice row.

---

## 6. Activity Wiring

Every email inbound → activity event `email.received`.
Every send → activity event `email.sent`.
Both link to project/lead/client.

Memory: every message (inbound and outbound) becomes a chunk in `ai_memory_chunks` (scope='project' or 'client', source='email').

---

## 7. Acceptance Checklist

- [ ] All Pillar 8 schemas + RLS.
- [ ] Gmail Pub/Sub configured for `info@voltsaudi.com`; watch row inserted; renewal cron set.
- [ ] Webhook endpoint at `/api/gmail/webhook` validates signatures + acks <30s + queues processing.
- [ ] Test: send email to info@ → within 10s appears as `email_messages` row.
- [ ] Routing test: 5 emails (one per known domain) auto-assign correctly.
- [ ] Draft create → approve → send via `mansouri@` alias → recipient receives + Antagna logs.
- [ ] Reject draft → status updates, no send.
- [ ] Template `chase_30d` substitutes vars correctly with real invoice context.
- [ ] Meeting note from `gemini-notes@google.com` arrives → linked to project via subject.
- [ ] AI summary populates within 30s of new thread creation.

---

## 8. Deferred

- **WhatsApp Meta Cloud API integration** → Phase 2 enhancement.
- **Inbox UI** (the unified mailbox view) → Pillar 12.
- **Snooze / archive UI** → Pillar 12.
- **Email scheduling beyond immediate send** → Pillar 11.

---

## 9. Next: Pillar 9 — Attendance & KPIs
