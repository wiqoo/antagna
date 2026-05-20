import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Pillar 13 — persisted Google OAuth tokens.
 * One row per authorized Google identity (e.g. `info@voltsaudi.com`).
 * We hold the refresh_token forever; access_token is refreshed on demand.
 */
export const googleIntegrations = pgTable('google_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  scope: text('scope').notNull(),
  tokenType: text('token_type').notNull().default('Bearer'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  connectedAt: timestamp('connected_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  lastError: text('last_error'),
  disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
