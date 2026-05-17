/**
 * Pillar 13 — Integration scaffolding.
 *
 * The actual integration code (Drive auto-folders, Calendar sync, Gemini meeting
 * note ingest, social platform API calls, ZATCA UBL XML) is BLOCKED on manual
 * setup of:
 *   - Google service account with domain-wide delegation
 *   - Resend domain verification (notifications.voltsaudi.com)
 *   - Per-platform OAuth tokens for Instagram / TikTok / YouTube
 *
 * The schema below lets us land the contracts, log every integration call, and
 * track which integrations are healthy.
 */
import {
  pgTable,
  uuid,
  bigserial,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';

/**
 * Reference to a secret stored elsewhere (Supabase Vault, Vercel encrypted env,
 * or Doppler — we don't put the cleartext token in the DB).
 *
 * `provider`        — e.g. 'google.drive', 'google.gmail', 'instagram.graph'
 * `subject`         — e.g. mailbox / channel ID / account handle that the secret
 *                     belongs to
 * `secret_ref`      — opaque pointer the runtime resolves via the vault
 * `scopes`          — text[] of what the token can do
 * `expires_at`      — when it dies; pre-expiry refresh job watches this
 */
export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull(),
  subject: text('subject').notNull(),
  secretRef: text('secret_ref').notNull(),
  refreshSecretRef: text('refresh_secret_ref'),
  scopes: text('scopes').array(),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
  lastRefreshError: text('last_refresh_error'),
  revoked: boolean('revoked').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

/**
 * Per-call log of every outbound integration call. Used by Pillar 11 alert
 * rules (e.g. social_token_expiring) and by the integration health dashboard.
 */
export const integrationLog = pgTable(
  'integration_log',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    provider: text('provider').notNull(),
    operation: text('operation').notNull(), // 'drive.create_folder' | 'calendar.create_event' | 'gmail.send' | …
    status: text('status').notNull(), // 'ok' | 'error' | 'rate_limited' | 'auth_failed'

    requestPayload: jsonb('request_payload'),
    responsePayload: jsonb('response_payload'),
    errorMessage: text('error_message'),

    durationMs: integer('duration_ms'),
    actorProfileId: uuid('actor_profile_id').references(() => profiles.id),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('integration_log_provider_idx').on(t.provider, t.createdAt.desc()),
    index('integration_log_errors_idx').on(t.provider, t.createdAt.desc()).where(sql`status <> 'ok'`),
  ],
);

export type OauthToken = typeof oauthTokens.$inferSelect;
export type IntegrationLog = typeof integrationLog.$inferSelect;
