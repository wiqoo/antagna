/**
 * Pillar 8 — Communications Layer.
 *
 * Email threads + messages + drafts + templates + Gmail Pub/Sub watch state,
 * WhatsApp (Baileys per D-023 — schema simplified vs Meta Cloud API),
 * meeting notes.
 *
 * Actual sending and Pub/Sub plumbing land in Pillar 13 alongside the
 * service-account Drive/Gmail/Calendar integration.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';
import { clients, contacts } from './orgs';
import { projects } from './projects';
import { leads } from './crm';
import { invoices } from './money';

// ── enums ──────────────────────────────────────────────────────────────────────

export const emailDirectionEnum = pgEnum('email_direction', ['inbound', 'outbound', 'internal']);

export const emailDraftStatusEnum = pgEnum('email_draft_status', [
  'draft',
  'awaiting_review',
  'approved',
  'queued',
  'sent',
  'failed',
  'cancelled',
]);

// ── email_threads ────────────────────────────────────────────────────────────

export const emailThreads = pgTable('email_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  gmailThreadId: text('gmail_thread_id').notNull().unique(),
  subject: text('subject'),

  projectId: uuid('project_id').references(() => projects.id),
  leadId: uuid('lead_id').references(() => leads.id),
  clientId: uuid('client_id').references(() => clients.id),
  primaryContactId: uuid('primary_contact_id').references(() => contacts.id),

  assignedProfileId: uuid('assigned_profile_id').references(() => profiles.id),
  status: text('status').notNull().default('open'), // 'open' | 'in_progress' | 'waiting_client' | 'closed' | 'spam'

  messageCount: integer('message_count').notNull().default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }),
  lastOutboundAt: timestamp('last_outbound_at', { withTimezone: true }),

  aiSummary: text('ai_summary'),
  aiSummaryUpdatedAt: timestamp('ai_summary_updated_at', { withTimezone: true }),
  aiTopicTags: text('ai_topic_tags').array(),

  // AI triage (migration 00000000000058). NULL = unclassified → treated as
  // actionable so nothing is hidden before classifyThread() has run.
  category: text('category'), // 'actionable' | 'marketing' | 'newsletter' | 'spam' | 'notification'
  importance: text('importance'), // 'low' | 'medium' | 'high'
  aiClassifiedAt: timestamp('ai_classified_at', { withTimezone: true }),

  // Smart reply-need + urgency (migration 00000000000069).
  replyStatus: text('reply_status'), // needs_reply | no_reply_needed | awaiting_them | handled_off_channel
  isUrgent: boolean('is_urgent').notNull().default(false),
  urgentReason: text('urgent_reason'),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── email_messages ───────────────────────────────────────────────────────────

export const emailMessages = pgTable(
  'email_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => emailThreads.id, { onDelete: 'cascade' }),
    gmailMessageId: text('gmail_message_id').unique(),
    internetMessageId: text('internet_message_id'),
    inReplyTo: text('in_reply_to'),

    direction: emailDirectionEnum('direction').notNull(),

    fromEmail: text('from_email').notNull(),
    fromName: text('from_name'),
    toEmails: text('to_emails').array().notNull(),
    ccEmails: text('cc_emails').array(),
    bccEmails: text('bcc_emails').array(),

    subject: text('subject'),
    bodyHtml: text('body_html'),
    bodyText: text('body_text'),
    snippet: text('snippet'),
    // Heuristic primary language of the body ('ar' | 'en' | 'mixed' | null) set
    // at ingest (free, codepoint-ratio). Drives the EN-mode "show original"
    // toggle + in-locale AI generation without re-detecting on every view.
    detectedLanguage: text('detected_language'),

    attachmentCount: integer('attachment_count').notNull().default(0),

    sentByProfileId: uuid('sent_by_profile_id').references(() => profiles.id),
    actingAsProfileId: uuid('acting_as_profile_id').references(() => profiles.id),

    aiSummary: text('ai_summary'),
    aiSuggestedActions: jsonb('ai_suggested_actions'),

    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('messages_by_thread').on(t.threadId, t.sentAt.desc())],
);

// ── email_templates ──────────────────────────────────────────────────────────

export const emailTemplates = pgTable('email_templates', {
  key: text('key').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  category: text('category'),
  subjectTemplate: text('subject_template').notNull(),
  bodyTemplate: text('body_template').notNull(),
  requiredVariables: text('required_variables').array(),
  requiresReview: boolean('requires_review').notNull().default(false),
  active: boolean('active').notNull().default(true),
});

// ── email_drafts ─────────────────────────────────────────────────────────────

export const emailDrafts = pgTable('email_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').references(() => emailThreads.id),
  projectId: uuid('project_id').references(() => projects.id),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  templateKey: text('template_key').references(() => emailTemplates.key),

  authorProfileId: uuid('author_profile_id')
    .notNull()
    .references(() => profiles.id),
  actingAsProfileId: uuid('acting_as_profile_id').references(() => profiles.id),
  sendFromAlias: text('send_from_alias').notNull(),

  toEmails: text('to_emails').array().notNull(),
  ccEmails: text('cc_emails').array(),
  bccEmails: text('bcc_emails').array(),

  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  bodyText: text('body_text'),

  status: emailDraftStatusEnum('status').notNull().default('draft'),
  approverProfileId: uuid('approver_profile_id').references(() => profiles.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedReason: text('rejected_reason'),

  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  sentMessageId: text('sent_message_id'),
  sendError: text('send_error'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── gmail_watch ──────────────────────────────────────────────────────────────

export const gmailWatch = pgTable('gmail_watch', {
  id: uuid('id').primaryKey().defaultRandom(),
  mailbox: text('mailbox').notNull().unique(),
  historyId: text('history_id'),
  watchExpiresAt: timestamp('watch_expires_at', { withTimezone: true }),
  lastRenewedAt: timestamp('last_renewed_at', { withTimezone: true }),
  pubsubTopic: text('pubsub_topic'),
  active: boolean('active').notNull().default(true),
});

// ── whatsapp_messages (Baileys, per D-023) ───────────────────────────────────

export const whatsappMessages = pgTable('whatsapp_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  baileysMessageId: text('baileys_message_id').unique(),
  direction: text('direction').notNull(), // 'inbound' | 'outbound'
  fromE164: text('from_e164').notNull(),
  toE164: text('to_e164').notNull(),
  // WhatsApp display name (pushname/notifyName) — shown when the real number is
  // hidden behind a @lid so the UI isn't just "lid:NNN".
  senderName: text('sender_name'),
  matchedContactId: uuid('matched_contact_id').references(() => contacts.id),
  matchedProfileId: uuid('matched_profile_id').references(() => profiles.id),
  messageType: text('message_type'), // 'text' | 'image' | 'video' | 'audio' | 'document'
  bodyText: text('body_text'),
  detectedLanguage: text('detected_language'), // 'ar' | 'en' | 'mixed' | null (heuristic at ingest)
  mediaUrl: text('media_url'),
  rawPayload: jsonb('raw_payload'),
  aiSummary: text('ai_summary'),
  aiClassification: text('ai_classification'),
  threadKey: text('thread_key'),
  projectId: uuid('project_id').references(() => projects.id),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── meeting_notes ────────────────────────────────────────────────────────────

export const meetingNotes = pgTable('meeting_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(), // 'gemini' | 'manual' | 'transcription_other'
  sourceId: text('source_id'),
  meetingTitle: text('meeting_title'),
  meetingDate: timestamp('meeting_date', { withTimezone: true }),
  attendeesText: text('attendees_text'),
  noteContent: text('note_content'),
  driveUrl: text('drive_url'),
  projectId: uuid('project_id').references(() => projects.id),
  clientId: uuid('client_id').references(() => clients.id),
  aiActionItems: jsonb('ai_action_items'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type EmailThread = typeof emailThreads.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type EmailDraft = typeof emailDrafts.$inferSelect;
export type GmailWatch = typeof gmailWatch.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type MeetingNote = typeof meetingNotes.$inferSelect;
