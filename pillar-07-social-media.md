# Pillar 7 — Social Media Module

**Status:** Planning
**Depends on:** Pillars 1-5
**Estimated effort:** 2-3 sessions

> **🩹 Patches (see [pillar-16-hardening.md](pillar-16-hardening.md)):**
> - **§J** — Social OAuth token health monitoring (refresh-before-expiry job, alert on revocation)

A first-class module for the social-media service line Volt provides to talents (Abu Luka, Maha, Kabsy currently). Replaces the manual one-event-per-Lexus-story calendar pattern. Cross-links to projects so we know "this campaign drove this post which drove these analytics".

---

## 1. Goals

- Registry of managed accounts (talent + platforms + access type).
- Content calendar: posts planned, drafted, scheduled, published, performing.
- Cross-link: post ↔ project ↔ client (the campaign source) ↔ equipment used ↔ team involved.
- Analytics ingestion from each platform (Instagram, TikTok, YouTube, X).
- Sponsored deal tracking: brand → talent → post → invoice flow.
- AI content ideation surface (Pillar 10 fills the AI).

## 2. Success Criteria

1. Create "Abu Luka MG GT review" post → assigned to draft → moves to scheduled → publish triggers a post-publish task ("upload analytics in 7 days").
2. Add new managed account ("Kabsy YouTube") in 3 fields.
3. Open Abu Luka page → see all his posts last 90 days with engagement metrics.
4. Sponsored deal → automatically creates a related project + invoice draft.
5. Content calendar view shows posts by date across all accounts in a grid.

---

## 3. Schema

### 3.1 `managed_accounts`

```typescript
export const socialPlatformEnum = pgEnum("social_platform", [
  "instagram", "tiktok", "youtube", "x", "snapchat", "linkedin", "facebook"
]);

export const managedAccounts = pgTable("managed_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                    // 'abuluka_ig', 'kabsy_yt', 'maha_tiktok'
  ownerLabel: text("owner_label").notNull(),                // 'Abu Luka', 'Maha', 'Kabsy'
  ownerProfileId: uuid("owner_profile_id").references(() => profiles.id),  // when owner is internal (Abu Luka, Kabsy)
  ownerClientId: uuid("owner_client_id").references(() => clients.id),     // when owner is external (Maha)

  platform: socialPlatformEnum("platform").notNull(),
  handle: text("handle").notNull(),                         // '@abuluka'
  externalAccountId: text("external_account_id"),           // Instagram graph ID, YouTube channel ID

  // Management
  accessType: text("access_type").notNull(),                // 'full_admin', 'editor', 'analytics_only', 'no_api'
  oauthTokenRef: text("oauth_token_ref"),                   // pointer to encrypted secret (not the token itself)

  // Current stats (cached daily by analytics job)
  followerCount: integer("follower_count"),
  postsCountLifetime: integer("posts_count_lifetime"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.2 `content_posts`

```typescript
export const postStatusEnum = pgEnum("post_status", [
  "idea", "drafting", "in_review", "scheduled", "published", "promoted", "archived", "cancelled"
]);
export const postFormatEnum = pgEnum("post_format", [
  "feed_image", "feed_carousel", "feed_video", "reel", "story", "short", "long_form_video", "live", "text"
]);

export const contentPosts = pgTable("content_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                    // 'POST-0001'
  accountId: uuid("account_id").notNull().references(() => managedAccounts.id),

  title: text("title").notNull(),
  caption: text("caption"),
  format: postFormatEnum("format").notNull(),
  status: postStatusEnum("status").notNull().default("idea"),

  // Optional links
  projectId: uuid("project_id").references(() => projects.id),  // when this post is for a paid campaign
  clientId: uuid("client_id").references(() => clients.id),     // sponsor / brand
  driveFolderId: text("drive_folder_id"),                       // assets folder

  // Schedule
  plannedPublishAt: timestamp("planned_publish_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  externalPostId: text("external_post_id"),                  // Instagram media ID, YouTube video ID
  externalPostUrl: text("external_post_url"),

  // Performance (cached, refreshed by analytics task)
  metricsCachedAt: timestamp("metrics_cached_at", { withTimezone: true }),
  views: bigint("views"),
  likes: integer("likes"),
  comments: integer("comments"),
  shares: integer("shares"),
  saves: integer("saves"),
  reachUnique: integer("reach_unique"),
  engagementRate: numeric("engagement_rate", { precision: 5, scale: 4 }),

  // Assignment (who's making it)
  createdById: uuid("created_by_id").references(() => profiles.id),
  editorId: uuid("editor_id").references(() => profiles.id),
  shooterId: uuid("shooter_id").references(() => profiles.id),

  // Free-form
  hashtags: text("hashtags").array(),
  mentions: text("mentions").array(),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.3 `post_analytics_snapshots` (time-series)

```typescript
export const postAnalyticsSnapshots = pgTable("post_analytics_snapshots", {
  id: bigserial("id").primaryKey(),
  postId: uuid("post_id").notNull().references(() => contentPosts.id, { onDelete: "cascade" }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  views: bigint("views"),
  likes: integer("likes"),
  comments: integer("comments"),
  shares: integer("shares"),
  saves: integer("saves"),
  reachUnique: integer("reach_unique"),
  rawPayload: jsonb("raw_payload"),                          // platform-specific raw response for debugging
}, (t) => ({
  byPostTime: index("snapshots_by_post_time").on(t.postId, t.capturedAt.desc()),
}));
```

Snapshots captured: at publish (T+0), T+1h, T+24h, T+72h, T+7d, T+30d.

### 3.4 `sponsored_deals`

```typescript
export const sponsoredDeals = pgTable("sponsored_deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                    // 'SPNS-0001'
  accountId: uuid("account_id").notNull().references(() => managedAccounts.id),
  sponsorClientId: uuid("sponsor_client_id").references(() => clients.id),

  dealType: text("deal_type").notNull(),                    // 'paid_post', 'barter', 'affiliate', 'long_term_ambassador'
  contractValueSar: numeric("contract_value_sar", { precision: 12, scale: 2 }),
  deliverablesCount: integer("deliverables_count"),
  usageRightsText: text("usage_rights_text"),

  status: text("status").notNull().default("draft"),        // 'draft', 'agreed', 'in_progress', 'completed', 'cancelled'

  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),

  projectId: uuid("project_id").references(() => projects.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.5 `content_calendar_view` (just an index, no new table)

The "content calendar" UI is a view over `content_posts` filtered by `planned_publish_at` window + account. No separate table needed.

---

## 4. Business Rules

```sql
-- Auto-generate codes
CREATE SEQUENCE IF NOT EXISTS post_code_seq START 1;
ALTER TABLE content_posts ALTER COLUMN code SET DEFAULT
  ('POST-' || LPAD(nextval('post_code_seq')::text, 4, '0'));

CREATE SEQUENCE IF NOT EXISTS sponsored_code_seq START 1;
ALTER TABLE sponsored_deals ALTER COLUMN code SET DEFAULT
  ('SPNS-' || LPAD(nextval('sponsored_code_seq')::text, 4, '0'));

-- When a post is published, queue analytics-capture tasks at standard intervals
CREATE OR REPLACE FUNCTION fn_queue_analytics_captures() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'published' THEN
    -- Emit event for Trigger.dev to schedule snapshots at T+1h, T+24h, T+72h, T+7d, T+30d
    PERFORM pg_notify('content_post_published', json_build_object('post_id', NEW.id)::text);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_queue_analytics AFTER UPDATE OF status ON content_posts
FOR EACH ROW EXECUTE FUNCTION fn_queue_analytics_captures();

-- When sponsored_deal moves to 'agreed', auto-create project (if not already linked)
-- and invoice draft based on contract value
-- (Trigger.dev task listens to pg_notify and creates these via API for transactional safety)
```

---

## 5. Analytics Ingestion (Trigger.dev tasks in Pillar 13)

Wire the actual API calls when we get to Pillar 13. For Pillar 7 we just define the contract:

- `task("analytics-snapshot")`: receives `{ post_id }`, fetches platform-specific metrics, inserts a snapshot, updates cached fields on `content_posts`.
- Scheduled `task("analytics-recurring")`: nightly, scans all `published` posts in last 30 days that don't have a today's snapshot, queues snapshot tasks.

---

## 6. UI Surfaces (Pillar 12)

- **Content Calendar**: grid view, columns = accounts, rows = days/weeks. Drag-drop to reschedule.
- **Account home page**: header (avatar, follower count, engagement trend graph), tabs for Posts, Analytics, Deals, Settings.
- **Post detail**: caption editor, file uploader (links Drive folder), schedule, metrics chart.
- **Sponsored deals page**: kanban (draft → agreed → in_progress → completed).
- **AI ideation panel** (Pillar 10): "based on Abu Luka's recent performance, here are 5 content ideas for next week".

---

## 7. Acceptance Checklist

- [ ] All schemas created with RLS.
- [ ] Seed: 3 managed_accounts (Abu Luka IG, Maha placeholder, Kabsy placeholder).
- [ ] Insert test post → status `idea` → drag to `published` → trigger queues notification.
- [ ] Insert 6 sample post_analytics_snapshots → trend query returns chronological data.
- [ ] Sponsored_deal → agreed → linked project visible in deal page.
- [ ] Calendar view query returns 30 days of posts in <100ms for a 100-post dataset.

---

## 8. Deferred

- **Platform API integrations** (Instagram Graph, TikTok, YouTube Data) → Pillar 13.
- **OAuth token storage** for accounts (encryption strategy) → Pillar 13.
- **AI content suggestions** → Pillar 10.
- **Analytics dashboards** → Pillar 12.

---

## 9. Next: Pillar 8 — Communications Layer

The biggest deferred work. Gmail Pub/Sub → AI parsing → inbox routing → unified thread view. Draft/Review/Send workflow. Meeting notes via Gemini. Phase 2: WhatsApp.
