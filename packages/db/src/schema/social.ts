/**
 * Pillar 7 — Social Media Module.
 *
 * Managed accounts (Abu Luka / Maha / Kabsy), content posts with full lifecycle,
 * time-series analytics snapshots, sponsored deals tying paid campaigns to
 * accounts + clients + invoices.
 *
 * OAuth tokens are stored by REFERENCE only (oauthTokenRef points at an
 * encrypted secret) — actual fetching APIs land in Pillar 13 once Mohammed
 * provides the platform-specific OAuth flows.
 */
import {
  pgTable,
  uuid,
  bigserial,
  bigint,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles, talents } from './people';
import { clients } from './orgs';
import { projects } from './projects';
import { invoices } from './money';

// ── enums ──────────────────────────────────────────────────────────────────────

export const socialPlatformEnum = pgEnum('social_platform', [
  'instagram',
  'tiktok',
  'youtube',
  'x',
  'snapchat',
  'linkedin',
  'facebook',
]);

export const postStatusEnum = pgEnum('post_status', [
  'idea',
  'drafting',
  'in_review',
  'scheduled',
  'published',
  'promoted',
  'archived',
  'cancelled',
]);

export const postFormatEnum = pgEnum('post_format', [
  'feed_image',
  'feed_carousel',
  'feed_video',
  'reel',
  'story',
  'short',
  'long_form_video',
  'live',
  'text',
]);

// ── managed_accounts ──────────────────────────────────────────────────────────

export const managedAccounts = pgTable('managed_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  ownerLabel: text('owner_label').notNull(),
  ownerProfileId: uuid('owner_profile_id').references(() => profiles.id),
  ownerClientId: uuid('owner_client_id').references(() => clients.id),
  ownerTalentId: uuid('owner_talent_id').references(() => talents.id), // Pillar 16 §D.2

  platform: socialPlatformEnum('platform').notNull(),
  handle: text('handle').notNull(),
  externalAccountId: text('external_account_id'),

  accessType: text('access_type').notNull(), // 'full_admin' | 'editor' | 'analytics_only' | 'no_api'
  oauthTokenRef: text('oauth_token_ref'),

  followerCount: integer('follower_count'),
  postsCountLifetime: integer('posts_count_lifetime'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),

  active: boolean('active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── content_posts ────────────────────────────────────────────────────────────

export const contentPosts = pgTable('content_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => managedAccounts.id),

  title: text('title').notNull(),
  caption: text('caption'),
  format: postFormatEnum('format').notNull(),
  status: postStatusEnum('status').notNull().default('idea'),

  projectId: uuid('project_id').references(() => projects.id),
  clientId: uuid('client_id').references(() => clients.id),
  driveFolderId: text('drive_folder_id'),

  plannedPublishAt: timestamp('planned_publish_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  externalPostId: text('external_post_id'),
  externalPostUrl: text('external_post_url'),

  metricsCachedAt: timestamp('metrics_cached_at', { withTimezone: true }),
  views: bigint('views', { mode: 'bigint' }),
  likes: integer('likes'),
  comments: integer('comments'),
  shares: integer('shares'),
  saves: integer('saves'),
  reachUnique: integer('reach_unique'),
  engagementRate: numeric('engagement_rate', { precision: 5, scale: 4 }),

  createdById: uuid('created_by_id').references(() => profiles.id),
  editorId: uuid('editor_id').references(() => profiles.id),
  shooterId: uuid('shooter_id').references(() => profiles.id),

  hashtags: text('hashtags').array(),
  mentions: text('mentions').array(),
  notes: text('notes'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── post_analytics_snapshots (time-series) ────────────────────────────────────

export const postAnalyticsSnapshots = pgTable(
  'post_analytics_snapshots',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().default(sql`now()`),
    views: bigint('views', { mode: 'bigint' }),
    likes: integer('likes'),
    comments: integer('comments'),
    shares: integer('shares'),
    saves: integer('saves'),
    reachUnique: integer('reach_unique'),
    rawPayload: jsonb('raw_payload'),
  },
  (t) => [index('snapshots_by_post_time').on(t.postId, t.capturedAt.desc())],
);

// ── sponsored_deals ──────────────────────────────────────────────────────────

export const sponsoredDeals = pgTable('sponsored_deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => managedAccounts.id),
  sponsorClientId: uuid('sponsor_client_id').references(() => clients.id),

  dealType: text('deal_type').notNull(), // 'paid_post' | 'barter' | 'affiliate' | 'long_term_ambassador'
  contractValueSar: numeric('contract_value_sar', { precision: 12, scale: 2 }),
  deliverablesCount: integer('deliverables_count'),
  usageRightsText: text('usage_rights_text'),

  status: text('status').notNull().default('draft'), // 'draft' | 'agreed' | 'in_progress' | 'completed' | 'cancelled'

  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),

  projectId: uuid('project_id').references(() => projects.id),
  invoiceId: uuid('invoice_id').references(() => invoices.id),

  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type ManagedAccount = typeof managedAccounts.$inferSelect;
export type ContentPost = typeof contentPosts.$inferSelect;
export type PostAnalyticsSnapshot = typeof postAnalyticsSnapshots.$inferSelect;
export type SponsoredDeal = typeof sponsoredDeals.$inferSelect;
