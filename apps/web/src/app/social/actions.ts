'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

/** The transaction handle passed into withActor's callback. */
type Tx = Parameters<Parameters<typeof withActor>[1]>[0];

const FORMATS = [
  'feed_image',
  'feed_carousel',
  'feed_video',
  'reel',
  'story',
  'short',
  'long_form_video',
  'live',
  'text',
];

const POST_STATUSES = [
  'idea',
  'drafting',
  'in_review',
  'scheduled',
  'published',
  'promoted',
  'archived',
  'cancelled',
];

const PLATFORMS = [
  'instagram',
  'tiktok',
  'youtube',
  'x',
  'snapchat',
  'linkedin',
  'facebook',
];

const ACCESS_TYPES = ['full_admin', 'editor', 'analytics_only', 'no_api'];

const DEAL_TYPES = ['paid_post', 'barter', 'affiliate', 'long_term_ambassador'];

const DEAL_STATUSES = ['draft', 'agreed', 'in_progress', 'completed', 'cancelled'];

function gen(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// ── managed accounts ─────────────────────────────────────────────────────────

/**
 * Register a managed social account manually. OAuth posting is permanently off
 * (D-028) — accounts are reference + analytics records only. Gated project.update.
 */
export async function createManagedAccount(formData: FormData): Promise<void> {
  const aid = await requirePermissionAction('project.update');

  const ownerLabel = formData.get('ownerLabel')?.toString().trim();
  const platform = formData.get('platform')?.toString() || '';
  const handle = formData.get('handle')?.toString().trim().replace(/^@/, '');
  const accessType = formData.get('accessType')?.toString() || 'no_api';
  const followerRaw = formData.get('followerCount')?.toString().trim() || null;
  const notes = formData.get('notes')?.toString().trim() || null;
  if (!ownerLabel || !handle || !PLATFORMS.includes(platform)) return;
  const access = ACCESS_TYPES.includes(accessType) ? accessType : 'no_api';
  const followers = followerRaw && Number.isFinite(Number(followerRaw)) ? Number(followerRaw) : null;

  const code = gen('SA');
  await withActor(aid, async (tx: Tx) => {
    await tx.execute(sql`
      INSERT INTO managed_accounts
        (code, owner_label, platform, handle, access_type, follower_count, notes, active)
      VALUES (
        ${code}, ${ownerLabel}, ${platform}::social_platform, ${handle},
        ${access}, ${followers === null ? sql`NULL` : sql`${followers}::int`},
        ${notes}, true
      )
    `);
  });
  await writeActivity({
    actorId: aid,
    entityType: 'managed_account',
    action: 'managed_account_created',
    summaryAr: `حساب مُدار جديد: @${handle} (${platform})`,
    summaryEn: `New managed account: @${handle} (${platform})`,
    metadata: { platform, handle, code },
  });
  revalidatePath('/social');
  revalidatePath('/social/accounts');
}

// ── content posts ──────────────────────────────────────────────────────────

/** Add a planned content post (manual content calendar — OAuth posting stays off, D-028). */
export async function createContentPost(formData: FormData): Promise<void> {
  const aid = await requirePermissionAction('project.update');

  const accountId = formData.get('accountId')?.toString() || null;
  const title = formData.get('title')?.toString().trim();
  const caption = formData.get('caption')?.toString().trim() || null;
  const format = formData.get('format')?.toString() || 'reel';
  const plannedPublishAt = formData.get('plannedPublishAt')?.toString() || null;
  if (!accountId || !title || !FORMATS.includes(format)) return;

  const code = gen('CP');
  await withActor(aid, async (tx: Tx) => {
    await tx.execute(sql`
      INSERT INTO content_posts
        (code, account_id, title, caption, format, status, planned_publish_at, created_by_id)
      VALUES (
        ${code}, ${accountId}::uuid, ${title}, ${caption},
        ${format}::post_format,
        ${plannedPublishAt ? sql`'scheduled'::post_status` : sql`'idea'::post_status`},
        ${plannedPublishAt ? sql`${plannedPublishAt}::timestamptz` : sql`NULL`},
        ${aid}::uuid
      )
    `);
  });

  await writeActivity({
    actorId: aid,
    entityType: 'content_post',
    action: 'content_post_created',
    summaryAr: `فكرة محتوى جديدة: ${title}`,
    summaryEn: `New content idea: ${title}`,
    metadata: { format, code },
  });
  revalidatePath('/social');
  revalidatePath('/social/calendar');
}

/** Move a post along the lifecycle (idea → … → published). Gated project.update. */
export async function updatePostStatus(formData: FormData): Promise<void> {
  const aid = await requirePermissionAction('project.update');

  const postId = formData.get('postId')?.toString() || null;
  const status = formData.get('status')?.toString() || '';
  if (!postId || !POST_STATUSES.includes(status)) return;

  const setPublished = status === 'published';
  await withActor(aid, async (tx: Tx) => {
    await tx.execute(sql`
      UPDATE content_posts SET
        status = ${status}::post_status,
        published_at = ${setPublished ? sql`COALESCE(published_at, now())` : sql`published_at`},
        updated_at = now()
      WHERE id = ${postId}::uuid
    `);
  });
  await writeActivity({
    actorId: aid,
    entityType: 'content_post',
    entityId: postId,
    action: 'content_post_status_changed',
    summaryAr: `حالة المنشور صارت: ${status}`,
    summaryEn: `Post status → ${status}`,
    metadata: { status },
  });
  revalidatePath('/social/calendar');
  revalidatePath('/social');
}

/**
 * Capture a manual analytics snapshot for a post (tracking-only, no API pull).
 * Writes a row into the time-series table AND caches the latest on content_posts.
 */
export async function recordSnapshot(formData: FormData): Promise<void> {
  const aid = await requirePermissionAction('project.update');

  const postId = formData.get('postId')?.toString() || null;
  if (!postId) return;
  const num = (k: string) => {
    const v = formData.get(k)?.toString().trim();
    return v && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  const views = num('views');
  const likes = num('likes');
  const comments = num('comments');
  const shares = num('shares');
  const saves = num('saves');
  const reach = num('reachUnique');
  // engagement rate ≈ (likes+comments+shares+saves) / reach
  const interactions = (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0);
  const er = reach && reach > 0 ? Math.min(0.9999, interactions / reach) : null;

  await withActor(aid, async (tx: Tx) => {
    await tx.execute(sql`
      INSERT INTO post_analytics_snapshots
        (post_id, views, likes, comments, shares, saves, reach_unique)
      VALUES (
        ${postId}::uuid,
        ${views === null ? sql`NULL` : sql`${views}::bigint`},
        ${likes === null ? sql`NULL` : sql`${likes}::int`},
        ${comments === null ? sql`NULL` : sql`${comments}::int`},
        ${shares === null ? sql`NULL` : sql`${shares}::int`},
        ${saves === null ? sql`NULL` : sql`${saves}::int`},
        ${reach === null ? sql`NULL` : sql`${reach}::int`}
      )
    `);
    await tx.execute(sql`
      UPDATE content_posts SET
        views = ${views === null ? sql`views` : sql`${views}::bigint`},
        likes = ${likes === null ? sql`likes` : sql`${likes}::int`},
        comments = ${comments === null ? sql`comments` : sql`${comments}::int`},
        shares = ${shares === null ? sql`shares` : sql`${shares}::int`},
        saves = ${saves === null ? sql`saves` : sql`${saves}::int`},
        reach_unique = ${reach === null ? sql`reach_unique` : sql`${reach}::int`},
        engagement_rate = ${er === null ? sql`engagement_rate` : sql`${er}::numeric`},
        metrics_cached_at = now(),
        updated_at = now()
      WHERE id = ${postId}::uuid
    `);
  });
  await writeActivity({
    actorId: aid,
    entityType: 'content_post',
    entityId: postId,
    action: 'analytics_snapshot_recorded',
    summaryAr: `لقطة تحليلات جديدة للمنشور`,
    summaryEn: `Analytics snapshot recorded`,
    metadata: { views, reach },
  });
  revalidatePath('/social/analytics');
  revalidatePath('/social');
}

// ── sponsored deals ──────────────────────────────────────────────────────────

/** Log a sponsored deal (tracking only — invoicing lives in Dafterah, D-022). */
export async function createSponsoredDeal(formData: FormData): Promise<void> {
  const aid = await requirePermissionAction('project.update');

  const accountId = formData.get('accountId')?.toString() || null;
  const dealType = formData.get('dealType')?.toString() || 'paid_post';
  const value = formData.get('contractValueSar')?.toString() || null;
  const delivCount = formData.get('deliverablesCount')?.toString() || null;
  const startsAt = formData.get('startsAt')?.toString() || null;
  const endsAt = formData.get('endsAt')?.toString() || null;
  const usageRights = formData.get('usageRightsText')?.toString().trim() || null;
  if (!accountId || !DEAL_TYPES.includes(dealType)) return;

  const code = gen('DEAL');
  await withActor(aid, async (tx: Tx) => {
    await tx.execute(sql`
      INSERT INTO sponsored_deals
        (code, account_id, deal_type, contract_value_sar, deliverables_count,
         usage_rights_text, status, starts_at, ends_at)
      VALUES (
        ${code}, ${accountId}::uuid, ${dealType},
        ${value ? sql`${value}::numeric` : sql`NULL`},
        ${delivCount ? sql`${delivCount}::int` : sql`NULL`},
        ${usageRights},
        'draft',
        ${startsAt ? sql`${startsAt}::timestamptz` : sql`NULL`},
        ${endsAt ? sql`${endsAt}::timestamptz` : sql`NULL`}
      )
    `);
  });
  await writeActivity({
    actorId: aid,
    entityType: 'sponsored_deal',
    action: 'deal_created',
    summaryAr: `صفقة رعاية جديدة (${dealType})`,
    summaryEn: `New sponsored deal (${dealType})`,
    metadata: { dealType, code },
  });
  revalidatePath('/social');
  revalidatePath('/social/deals');
}

/** Advance / change a sponsored deal status. Gated project.update. */
export async function updateDealStatus(formData: FormData): Promise<void> {
  const aid = await requirePermissionAction('project.update');

  const dealId = formData.get('dealId')?.toString() || null;
  const status = formData.get('status')?.toString() || '';
  if (!dealId || !DEAL_STATUSES.includes(status)) return;

  await withActor(aid, async (tx: Tx) => {
    await tx.execute(sql`
      UPDATE sponsored_deals SET status = ${status}
      WHERE id = ${dealId}::uuid
    `);
  });
  await writeActivity({
    actorId: aid,
    entityType: 'sponsored_deal',
    entityId: dealId,
    action: 'deal_status_changed',
    summaryAr: `حالة صفقة الرعاية: ${status}`,
    summaryEn: `Sponsored deal status → ${status}`,
    metadata: { status },
  });
  revalidatePath('/social/deals');
  revalidatePath('/social');
}
