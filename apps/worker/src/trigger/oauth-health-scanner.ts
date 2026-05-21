/**
 * Pillar 13/16 §O.2 — OAuth token health monitoring.
 *
 * Every 4 hours we scan google_integrations and fire an alert when:
 *   - last_error is set (refresh failed; manual reconnect needed)
 *   - expires_at < now + 24h AND refresh_token absent or stale
 *   - disconnected_at is set unexpectedly
 *
 * Fires go into alert_fires (rule_key='oauth_token_expiring_7d') with the
 * rich detail in metadata so the dashboard / notifications layer can render
 * an actionable message. We respect the rule's cooldown (60m by default).
 */
import { schedules } from '@trigger.dev/sdk';
import { db } from '@antagna/db';
import { sql } from 'drizzle-orm';

const RULE_KEY = 'oauth_token_expiring_7d';

type IntegrationRow = {
  id: string;
  email: string;
  expires_at: Date;
  last_error: string | null;
  disconnected_at: Date | null;
  last_refreshed_at: Date;
  [k: string]: unknown;
};

export const oauthHealthScanner = schedules.task({
  id: 'oauth-health-scanner',
  cron: '0 */4 * * *',
  maxDuration: 60,
  run: async (_payload, { ctx }) => {
    const startedAt = Date.now();

    const integrations = await db.execute<IntegrationRow>(sql`
      SELECT id, email, expires_at, last_error, disconnected_at, last_refreshed_at
      FROM google_integrations
    `);
    const rows = integrations as unknown as IntegrationRow[];

    // Pull the rule's cooldown window so we don't double-fire.
    const cooldownRows = await db.execute<{ cooldown_minutes: number }>(sql`
      SELECT cooldown_minutes FROM alert_rules WHERE key = ${RULE_KEY}
    `);
    const cooldown =
      (cooldownRows as unknown as { cooldown_minutes: number }[])[0]
        ?.cooldown_minutes ?? 60;

    let firedCount = 0;
    let healthyCount = 0;
    let cooldownSkipped = 0;

    for (const row of rows) {
      const reasons: string[] = [];
      let severity: 'critical' | 'warning' | 'info' = 'info';

      if (row.disconnected_at) {
        reasons.push('disconnected');
        severity = 'critical';
      } else if (row.last_error) {
        reasons.push('refresh_failed');
        severity = 'critical';
      } else {
        const msUntilExpiry =
          new Date(row.expires_at).getTime() - Date.now();
        const hoursUntilExpiry = msUntilExpiry / 3_600_000;
        // 1h proactive refresh window already exists in lib/google.ts —
        // alert only if we're past that and still haven't refreshed.
        const minsSinceRefresh =
          (Date.now() - new Date(row.last_refreshed_at).getTime()) / 60_000;
        if (hoursUntilExpiry < 24 && minsSinceRefresh > 60) {
          reasons.push('approaching_expiry');
          severity = 'warning';
        }
      }

      if (reasons.length === 0) {
        healthyCount++;
        continue;
      }

      // Cooldown: any fire for this entity within window?
      const lastFire = await db.execute<{ fired_at: Date }>(sql`
        SELECT fired_at FROM alert_fires
        WHERE rule_key = ${RULE_KEY}
          AND entity_type = 'google_integration'
          AND entity_id = ${row.id}::uuid
        ORDER BY fired_at DESC LIMIT 1
      `);
      const last = (lastFire as unknown as { fired_at: Date }[])[0]?.fired_at;
      if (last) {
        const ageMin = (Date.now() - new Date(last).getTime()) / 60_000;
        if (ageMin < cooldown) {
          cooldownSkipped++;
          continue;
        }
      }

      await db.execute(sql`
        INSERT INTO alert_fires (
          rule_key, entity_type, entity_id, escalation_step, metadata
        ) VALUES (
          ${RULE_KEY},
          'google_integration',
          ${row.id}::uuid,
          0,
          ${JSON.stringify({
            email: row.email,
            reasons,
            severity,
            expires_at: row.expires_at,
            last_error: row.last_error,
          })}::jsonb
        )
      `);
      firedCount++;
    }

    return {
      runId: ctx.run.id,
      durationMs: Date.now() - startedAt,
      total: rows.length,
      healthy: healthyCount,
      fired: firedCount,
      cooldownSkipped,
    };
  },
});
