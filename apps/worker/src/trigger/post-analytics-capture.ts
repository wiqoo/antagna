/**
 * Pillar 7 — Social post analytics snapshot capture.
 *
 * Runs every 6 hours. Looks up published content_posts that need a fresh
 * snapshot (last_snapshot_at older than 6 hours OR null) and writes a row to
 * post_analytics_snapshots. Actual platform API calls land here once the
 * social OAuth tokens are configured (currently MANUAL).
 */
import { schedules } from '@trigger.dev/sdk/v3';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

export const postAnalyticsCapture = schedules.task({
  id: 'post-analytics-capture',
  cron: '15 */6 * * *',
  maxDuration: 600,
  run: async (_payload, { ctx }) => {
    const startedAt = Date.now();

    const dueRes = await db.execute<{
      id: string;
      platform: string;
      external_id: string;
      managed_account_id: string;
    }>(sql`
      SELECT cp.id, cp.platform, cp.external_id, cp.managed_account_id
      FROM content_posts cp
      WHERE cp.status = 'published'
        AND cp.external_id IS NOT NULL
        AND (
          NOT EXISTS (
            SELECT 1 FROM post_analytics_snapshots s
            WHERE s.content_post_id = cp.id
          )
          OR (
            SELECT max(captured_at) FROM post_analytics_snapshots
            WHERE content_post_id = cp.id
          ) < now() - interval '6 hours'
        )
      LIMIT 200
    `);

    const dueArr = dueRes as unknown as Array<{
      id: string;
      platform: string;
      external_id: string;
      managed_account_id: string;
    }>;

    let captured = 0;
    let skipped = 0;

    for (const post of dueArr) {
      const tokenRes = await db.execute<{ access_token: string; expires_at: Date | null }>(sql`
        SELECT access_token, expires_at
        FROM oauth_tokens
        WHERE provider = ${post.platform}
          AND linked_account_id = ${post.managed_account_id}::uuid
          AND revoked_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      `);
      const tokenArr = tokenRes as unknown as Array<{ access_token: string; expires_at: Date | null }>;
      if (tokenArr.length === 0) {
        skipped++;
        continue;
      }

      // TODO(Pillar 13 runtime): hit the platform's insights endpoint with the
      // access token and convert the response into our schema's columns.
      // For now we INSERT a zero-snapshot just to prove the writer path works.
      try {
        await db.execute(sql`
          INSERT INTO post_analytics_snapshots
            (content_post_id, captured_at, impressions, reach, likes, comments, shares, saves, video_views, raw_payload)
          VALUES
            (${post.id}::uuid, now(), 0, 0, 0, 0, 0, 0, 0, '{"stub": true}'::jsonb)
        `);
        captured++;
      } catch (err) {
        console.error(`[post-analytics-capture] insert failed for ${post.id}:`, err);
      }
    }

    return {
      ranId: ctx.run.id,
      durationMs: Date.now() - startedAt,
      due: dueArr.length,
      captured,
      skippedMissingToken: skipped,
    };
  },
});
