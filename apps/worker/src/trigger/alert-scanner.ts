/**
 * Pillar 11 — Automation & Alerts scanner.
 *
 * Scans `alert_rules` every 5 minutes (the pg_cron `antagna_alert_scan_tick`
 * heartbeat also exists, but the worker is what evaluates trigger_spec and
 * writes alert_fires + notifications).
 *
 * Trigger.dev v3 scheduled task. Deploys only when PROD key exists.
 */
import { schedules } from '@trigger.dev/sdk';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

export const alertScanner = schedules.task({
  id: 'alert-scanner',
  cron: '*/5 * * * *',
  maxDuration: 60,
  run: async (_payload, { ctx }) => {
    const startedAt = Date.now();

    // Pull all active rules.
    const rules = await db.execute<{
      key: string;
      trigger_type: string;
      trigger_spec: unknown;
      cooldown_minutes: number;
    }>(sql`
      SELECT key, trigger_type, trigger_spec, cooldown_minutes
      FROM alert_rules
      WHERE active = true
    `);

    let firedCount = 0;
    let cooldownSkipped = 0;
    const rulesArr = rules as unknown as Array<{
      key: string;
      trigger_type: string;
      trigger_spec: Record<string, unknown>;
      cooldown_minutes: number;
    }>;

    for (const rule of rulesArr) {
      const lastFireRes = await db.execute<{ fired_at: Date }>(sql`
        SELECT fired_at FROM alert_fires
        WHERE rule_key = ${rule.key}
        ORDER BY fired_at DESC LIMIT 1
      `);
      const lastFireArr = lastFireRes as unknown as Array<{ fired_at: Date }>;
      const lastFire = lastFireArr[0]?.fired_at;
      if (lastFire) {
        const ageMin = (Date.now() - new Date(lastFire).getTime()) / 60_000;
        if (ageMin < rule.cooldown_minutes) {
          cooldownSkipped++;
          continue;
        }
      }

      // Each rule has its own evaluator. For now, only `schedule` rules with a
      // built-in handler key are evaluated; `event` rules fire from DB triggers,
      // and `threshold` rules are stubbed until we wire kpi_snapshots → here.
      if (rule.trigger_type !== 'schedule') continue;

      const handler = rule.trigger_spec['handler'] as string | undefined;
      if (!handler) continue;

      try {
        const fires = await runHandler(handler, rule.trigger_spec);
        for (const f of fires) {
          await db.execute(sql`
            INSERT INTO alert_fires (rule_key, entity_type, entity_id, metadata)
            VALUES (${rule.key}, ${f.entityType}, ${f.entityId}::uuid, ${JSON.stringify(f.metadata ?? {})}::jsonb)
          `);
          firedCount++;
        }
      } catch (err) {
        console.error(`[alert-scanner] rule ${rule.key} failed:`, err);
      }
    }

    // Piggyback the WhatsApp media + voice scanner (same 5-min cadence; keeps
    // us under Trigger.dev Pro's 10-schedule cap).
    let mediaSummary: { checked: number; stashed: number; transcribed: number } = {
      checked: 0,
      stashed: 0,
      transcribed: 0,
    };
    try {
      const { runWhatsappMediaScan } = await import('./whatsapp-media-scanner');
      mediaSummary = await runWhatsappMediaScan();
    } catch (err) {
      console.error('[alert-scanner] whatsapp-media-scanner failed:', err);
    }

    return {
      ranId: ctx.run.id,
      durationMs: Date.now() - startedAt,
      rulesEvaluated: rulesArr.length,
      firedCount,
      cooldownSkipped,
      mediaSummary,
    };
  },
});

type Fire = { entityType: string; entityId: string; metadata?: Record<string, unknown> };

async function runHandler(
  handler: string,
  spec: Record<string, unknown>,
): Promise<Fire[]> {
  switch (handler) {
    case 'project_brief_stuck': {
      const days = (spec['days'] as number) ?? 3;
      const rows = await db.execute<{ id: string; code: string; stuck_days: number }>(sql`
        SELECT id, code,
               EXTRACT(EPOCH FROM (now() - updated_at))::int / 86400 AS stuck_days
        FROM projects
        WHERE stage = 'brief'
          AND archived_at IS NULL
          AND updated_at < now() - (${days}::int || ' days')::interval
      `);
      const rowsArr = rows as unknown as Array<{ id: string; code: string; stuck_days: number }>;
      return rowsArr.map((r) => ({
        entityType: 'project',
        entityId: r.id,
        metadata: { code: r.code, stuck_days: r.stuck_days, handler },
      }));
    }
    case 'project_delivery_overdue': {
      const rows = await db.execute<{ id: string; code: string; days_overdue: number }>(sql`
        SELECT id, code,
               EXTRACT(EPOCH FROM (now() - delivery_due_at))::int / 86400 AS days_overdue
        FROM projects
        WHERE delivery_due_at IS NOT NULL
          AND delivery_due_at < now()
          AND stage NOT IN ('delivered','archived','lost','cancelled')
      `);
      const rowsArr = rows as unknown as Array<{ id: string; code: string; days_overdue: number }>;
      return rowsArr.map((r) => ({
        entityType: 'project',
        entityId: r.id,
        metadata: { code: r.code, days_overdue: r.days_overdue, handler },
      }));
    }
    case 'equipment_battery_low': {
      const rows = await db.execute<{ id: string; code: string; hours_since_charge: number }>(sql`
        SELECT id, code,
               EXTRACT(EPOCH FROM (now() - COALESCE(last_charged_at, '1970-01-01'::timestamptz)))::int / 3600
                 AS hours_since_charge
        FROM equipment
        WHERE requires_charging = true
          AND archived_at IS NULL
          AND (last_charged_at IS NULL OR last_charged_at < now() - interval '30 days')
      `);
      const rowsArr = rows as unknown as Array<{
        id: string;
        code: string;
        hours_since_charge: number;
      }>;
      return rowsArr.map((r) => ({
        entityType: 'equipment',
        entityId: r.id,
        metadata: { code: r.code, hours_since_charge: r.hours_since_charge, handler },
      }));
    }
    case 'lead_no_response': {
      const days = (spec['days'] as number) ?? 5;
      const rows = await db.execute<{ id: string; code: string; days_open: number }>(sql`
        SELECT id, code,
               EXTRACT(EPOCH FROM (now() - received_at))::int / 86400 AS days_open
        FROM leads
        WHERE status IN ('new','qualified','nurturing')
          AND received_at < now() - (${days}::int || ' days')::interval
      `);
      const rowsArr = rows as unknown as Array<{ id: string; code: string; days_open: number }>;
      return rowsArr.map((r) => ({
        entityType: 'lead',
        entityId: r.id,
        metadata: { code: r.code, days_open: r.days_open, handler },
      }));
    }
    default:
      console.warn(`[alert-scanner] unknown handler: ${handler}`);
      return [];
  }
}
