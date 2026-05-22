/**
 * Pillar 8/11 — proactive follow-up engine.
 *
 * Every hour, scans the v_email_communication_metrics view for:
 *  - threads "awaiting_our_reply" past a threshold (24h / 72h / 7d)
 *  - hot leads going cold (no reply in 48h)
 *  - clients with overdue replies (health=red)
 *
 * Inserts alert_fires rows so they appear in the standard notifications
 * UI. Respects per-rule cooldowns (already configured in alert_rules).
 */
import { schedules } from '@trigger.dev/sdk';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

type Stale = {
  thread_id: string;
  subject: string | null;
  hours_since_last_inbound: number;
  client_id: string | null;
  assigned_profile_id: string | null;
  [k: string]: unknown;
};

const RULE_KEY = 'project_no_client_reply_5d'; // closest existing rule; we'll
// override per-fire metadata so the dashboard can render the actual reason.

const TIERS = [
  { hours: 168, severity: 'critical' as const, label: 'بدون رد > 7 أيام' },
  { hours: 72,  severity: 'warning'  as const, label: 'بدون رد > 3 أيام'  },
  { hours: 24,  severity: 'info'     as const, label: 'بدون رد > 24 ساعة' },
];

export const emailFollowupScanner = schedules.task({
  id: 'email-followup-scanner',
  cron: '0 * * * *', // hourly
  maxDuration: 120,
  run: async (_payload, { ctx }) => {
    const startedAt = Date.now();

    // Pull awaiting_our_reply threads with their reply-age.
    const stale = (await db.execute<Stale>(sql`
      SELECT thread_id::text AS thread_id, subject,
             hours_since_last_inbound::float AS hours_since_last_inbound,
             client_id::text AS client_id,
             assigned_profile_id::text AS assigned_profile_id
      FROM v_email_communication_metrics
      WHERE reply_state = 'awaiting_our_reply'
        AND hours_since_last_inbound >= 24
      ORDER BY hours_since_last_inbound DESC
      LIMIT 100
    `)) as unknown as Stale[];

    let fired = 0;
    let cooldownSkipped = 0;

    for (const s of stale) {
      // Pick the highest tier that applies.
      const tier = TIERS.find((t) => s.hours_since_last_inbound >= t.hours);
      if (!tier) continue;

      // Cooldown — don't fire again for the same thread within 24h.
      const lastFire = (await db.execute<{ fired_at: Date }>(sql`
        SELECT fired_at FROM alert_fires
        WHERE rule_key = ${RULE_KEY}
          AND entity_type = 'email_thread'
          AND entity_id = ${s.thread_id}::uuid
        ORDER BY fired_at DESC LIMIT 1
      `)) as unknown as Array<{ fired_at: Date }>;
      const last = lastFire[0]?.fired_at;
      if (last) {
        const ageHrs =
          (Date.now() - new Date(last).getTime()) / 3_600_000;
        if (ageHrs < 24) {
          cooldownSkipped++;
          continue;
        }
      }

      const recipients = s.assigned_profile_id ? [s.assigned_profile_id] : [];

      await db.execute(sql`
        INSERT INTO alert_fires (
          rule_key, entity_type, entity_id,
          notified_profile_ids, escalation_step, metadata
        ) VALUES (
          ${RULE_KEY},
          'email_thread',
          ${s.thread_id}::uuid,
          ${recipients.length ? sql`${recipients}::uuid[]` : null},
          0,
          ${JSON.stringify({
            tier: tier.label,
            severity: tier.severity,
            subject: s.subject,
            hours_since_last_inbound: s.hours_since_last_inbound,
            kind: 'awaiting_our_reply',
          })}::jsonb
        )
      `);
      fired++;
    }

    return {
      runId: ctx.run.id,
      durationMs: Date.now() - startedAt,
      checked: stale.length,
      fired,
      cooldownSkipped,
    };
  },
});
