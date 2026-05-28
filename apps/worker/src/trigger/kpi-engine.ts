/**
 * Pillar 9 — KPI calculation engine.
 *
 * Runs daily at 04:30 UTC (07:30 Asia/Riyadh) and computes the foundational
 * KPIs into `kpi_snapshots`. Each handler is a function that returns one or
 * more snapshot rows; we don't evaluate kpi_definitions.compute_sql to avoid
 * the SQL-injection risk of executing strings from a config table.
 *
 * Idempotent: kpi_snapshots has a UNIQUE (kpi_key, scope_*, period_start)
 * so re-running the same day overwrites instead of duplicating.
 *
 * Currently implemented (the ones our schema/data actually supports):
 *   - active_projects_count       (company, hourly cadence — we run daily here)
 *   - open_leads_count            (company)
 *   - monthly_active_projects     (company)
 *   - equipment_utilization_pct   (company)
 *   - tasks_overdue_count         (person, per profile)
 *   - lead_conversion_pct         (company, derived from leads outcome)
 *   - attendance_present_pct      (company, PWA check-ins; C3)
 *   - team_size_count             (company, active profiles)
 *   - tasks_completed_count       (company, 30-day rolling)
 *   - shoots_completed_count      (company, 30-day rolling)
 *   - projects_count_last_12mo    (company, top-line growth)
 *   - days_brief_to_quote         (company, median 90d)
 *   - days_quote_to_award         (company, median 90d)
 *
 * Not yet implemented (need data Antagna doesn't have yet):
 *   - nps_avg, client_complaints   — needs survey data
 *   - monthly_revenue_sar, delivered_value_mtd, profit_margin_pct,
 *     avg_payment_days, repeat_rate, revenue_last_12mo_sar — needs Dafterah
 *     invoice/payment refs (D-022 webhook)
 *   - monthly_revenue_sar          — needs invoice/payment data
 */
import { schedules } from '@trigger.dev/sdk';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

type SnapshotRow = {
  kpi_key: string;
  scope_entity_type: string | null;
  scope_entity_id: string | null;
  period_start: string;   // ISO date
  period_end: string;     // ISO date
  value: number;
  metadata?: Record<string, unknown>;
};

function todayUtc(): { start: string; end: string } {
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start.getTime() + 86_400_000 - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export const kpiEngine = schedules.task({
  id: 'kpi-engine',
  cron: '30 4 * * *', // 04:30 UTC = 07:30 Asia/Riyadh
  maxDuration: 180,
  run: async (_payload, { ctx }) => {
    const startedAt = Date.now();
    const { start, end } = todayUtc();
    const snapshots: SnapshotRow[] = [];

    // 1) active_projects_count
    const ap = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM projects
      WHERE stage NOT IN ('delivered','archived','lost','cancelled')
        AND archived_at IS NULL
    `);
    snapshots.push({
      kpi_key: 'active_projects_count',
      scope_entity_type: null,
      scope_entity_id: null,
      period_start: start,
      period_end: end,
      value: (ap as unknown as { n: number }[])[0]?.n ?? 0,
    });

    // 2) open_leads_count — leads not closed/won/lost
    const ol = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM leads
      WHERE status NOT IN ('won','lost','disqualified')
        AND lost_at IS NULL
    `);
    snapshots.push({
      kpi_key: 'open_leads_count',
      scope_entity_type: null,
      scope_entity_id: null,
      period_start: start,
      period_end: end,
      value: (ol as unknown as { n: number }[])[0]?.n ?? 0,
    });

    // 3) monthly_active_projects — projects with any activity in last 30d
    const map = await db.execute<{ n: number }>(sql`
      SELECT count(DISTINCT p.id)::int AS n
      FROM projects p
      LEFT JOIN activity_events a ON a.entity_type = 'project' AND a.entity_id = p.id
      WHERE p.archived_at IS NULL
        AND (a.created_at > now() - interval '30 days' OR p.created_at > now() - interval '30 days')
    `);
    snapshots.push({
      kpi_key: 'monthly_active_projects',
      scope_entity_type: null,
      scope_entity_id: null,
      period_start: start,
      period_end: end,
      value: (map as unknown as { n: number }[])[0]?.n ?? 0,
    });

    // 4) equipment_utilization_pct — what % of catalog has an active reservation right now
    const eu = await db.execute<{ pct: number }>(sql`
      WITH total AS (
        SELECT count(*)::numeric AS n FROM equipment WHERE archived_at IS NULL
      ),
      busy AS (
        SELECT count(DISTINCT equipment_id)::numeric AS n
        FROM equipment_reservations
        WHERE reserved_from <= now() AND reserved_until >= now()
          AND returned_at IS NULL
      )
      SELECT CASE WHEN (SELECT n FROM total) = 0 THEN 0
                  ELSE ROUND(((SELECT n FROM busy) * 100.0 / (SELECT n FROM total))::numeric, 2)
             END AS pct
    `);
    snapshots.push({
      kpi_key: 'equipment_utilization_pct',
      scope_entity_type: null,
      scope_entity_id: null,
      period_start: start,
      period_end: end,
      value: Number((eu as unknown as { pct: number }[])[0]?.pct ?? 0),
    });

    // 5) tasks_overdue_count — per profile
    const overdue = await db.execute<{ profile_id: string; n: number }>(sql`
      SELECT assignee_id::text AS profile_id, count(*)::int AS n
      FROM project_tasks
      WHERE due_at IS NOT NULL
        AND due_at < now()
        AND status NOT IN ('done','cancelled')
        AND assignee_id IS NOT NULL
      GROUP BY assignee_id
    `);
    for (const r of overdue as unknown as { profile_id: string; n: number }[]) {
      snapshots.push({
        kpi_key: 'tasks_overdue_count',
        scope_entity_type: 'profile',
        scope_entity_id: r.profile_id,
        period_start: start,
        period_end: end,
        value: r.n,
      });
    }

    // 6) lead_conversion_pct — % of leads created in last 90 days that became projects
    const conv = await db.execute<{ pct: number; total: number; converted: number }>(sql`
      WITH recent AS (
        SELECT id, converted_to_project_id FROM leads
        WHERE received_at > now() - interval '90 days'
      )
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE converted_to_project_id IS NOT NULL)::int AS converted,
        CASE WHEN count(*) = 0 THEN 0
             ELSE ROUND((count(*) FILTER (WHERE converted_to_project_id IS NOT NULL) * 100.0 / count(*))::numeric, 2)
        END AS pct
      FROM recent
    `);
    const cRow = (conv as unknown as { pct: number; total: number; converted: number }[])[0];
    snapshots.push({
      kpi_key: 'lead_conversion_pct',
      scope_entity_type: null,
      scope_entity_id: null,
      period_start: start,
      period_end: end,
      value: Number(cRow?.pct ?? 0),
      metadata: { total: cRow?.total ?? 0, converted: cRow?.converted ?? 0 },
    });

    // ── Additional handlers (Cowork audit bug #6 — 20/28 KPIs had no engine
    // handler, only a row in kpi_definitions. The 6 below close the gap for
    // every metric we have data for; the remaining 14 need Dafterah / NPS /
    // survey ingestion to come online first.) ────────────────────────────────

    // team_size_count — active profiles right now.
    {
      const r = (await db.execute(sql`SELECT count(*)::int AS n FROM profiles WHERE active = true`)) as unknown as { n: number }[];
      snapshots.push({
        kpi_key: 'team_size_count', scope_entity_type: null, scope_entity_id: null,
        period_start: start, period_end: end, value: Number(r[0]?.n ?? 0),
      });
    }

    // tasks_completed_count — project_tasks marked completed in the trailing
    // 30 days.
    {
      const r = (await db.execute(sql`
        SELECT count(*)::int AS n FROM project_tasks
        WHERE status = 'completed' AND completed_at >= now() - interval '30 days'
      `)) as unknown as { n: number }[];
      snapshots.push({
        kpi_key: 'tasks_completed_count', scope_entity_type: null, scope_entity_id: null,
        period_start: start, period_end: end, value: Number(r[0]?.n ?? 0),
      });
    }

    // shoots_completed_count — projects whose shoot_ends_at fell in the
    // trailing 30 days and the project moved past 'shooting'.
    {
      const r = (await db.execute(sql`
        SELECT count(*)::int AS n FROM projects
        WHERE shoot_ends_at >= now() - interval '30 days'
          AND shoot_ends_at <= now()
          AND stage::text IN ('editing','review','delivered')
      `)) as unknown as { n: number }[];
      snapshots.push({
        kpi_key: 'shoots_completed_count', scope_entity_type: null, scope_entity_id: null,
        period_start: start, period_end: end, value: Number(r[0]?.n ?? 0),
      });
    }

    // projects_count_last_12mo — projects created in the last 12 months
    // (regardless of stage). Useful for top-line growth.
    {
      const r = (await db.execute(sql`
        SELECT count(*)::int AS n FROM projects
        WHERE created_at >= now() - interval '12 months'
      `)) as unknown as { n: number }[];
      snapshots.push({
        kpi_key: 'projects_count_last_12mo', scope_entity_type: null, scope_entity_id: null,
        period_start: start, period_end: end, value: Number(r[0]?.n ?? 0),
      });
    }

    // days_brief_to_quote — median days between brief_received_at and quoted_at
    // for projects quoted in the last 90 days. Median over avg to dampen
    // outlier rushes/delays.
    {
      const r = (await db.execute(sql`
        SELECT COALESCE(
          percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (quoted_at - brief_received_at)) / 86400.0),
          0
        )::float8 AS d
        FROM projects
        WHERE brief_received_at IS NOT NULL
          AND quoted_at IS NOT NULL
          AND quoted_at >= now() - interval '90 days'
      `)) as unknown as { d: number }[];
      snapshots.push({
        kpi_key: 'days_brief_to_quote', scope_entity_type: null, scope_entity_id: null,
        period_start: start, period_end: end, value: Number(r[0]?.d ?? 0),
      });
    }

    // days_quote_to_award — median days between quoted_at and approved_at
    // for projects approved in the last 90 days.
    {
      const r = (await db.execute(sql`
        SELECT COALESCE(
          percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (approved_at - quoted_at)) / 86400.0),
          0
        )::float8 AS d
        FROM projects
        WHERE quoted_at IS NOT NULL
          AND approved_at IS NOT NULL
          AND approved_at >= now() - interval '90 days'
      `)) as unknown as { d: number }[];
      snapshots.push({
        kpi_key: 'days_quote_to_award', scope_entity_type: null, scope_entity_id: null,
        period_start: start, period_end: end, value: Number(r[0]?.d ?? 0),
      });
    }

    // C3 — attendance_present_pct. % of active profiles who checked in today
    // (any of the "check_in_*" / remote_start types).
    const att = await db.execute(sql`
      WITH active_people AS (
        SELECT id FROM profiles WHERE active = true
      ),
      present_today AS (
        SELECT DISTINCT profile_id
        FROM attendance_records
        WHERE type IN ('check_in_office','check_in_shoot','remote_start')
          AND server_timestamp >= ${start}::timestamptz
          AND server_timestamp <  (${end}::timestamptz + interval '1 day')
      )
      SELECT
        (SELECT count(*) FROM active_people)::int  AS total,
        (SELECT count(*) FROM present_today)::int  AS present,
        CASE WHEN (SELECT count(*) FROM active_people) = 0 THEN 0
             ELSE ROUND(
               ((SELECT count(*) FROM present_today) * 100.0
                / (SELECT count(*) FROM active_people))::numeric, 2)
        END AS pct
    `);
    const aRow = (att as unknown as { total: number; present: number; pct: number }[])[0];
    snapshots.push({
      kpi_key: 'attendance_present_pct',
      scope_entity_type: null,
      scope_entity_id: null,
      period_start: start,
      period_end: end,
      value: Number(aRow?.pct ?? 0),
      metadata: { total: aRow?.total ?? 0, present: aRow?.present ?? 0 },
    });

    // Ensure all KPI keys referenced above exist in kpi_definitions; if missing,
    // skip them rather than violating the FK.
    const keys = Array.from(new Set(snapshots.map((s) => s.kpi_key)));
    const known = await db.execute<{ key: string }>(sql`
      SELECT key FROM kpi_definitions WHERE key = ANY(${keys}::text[])
    `);
    const knownSet = new Set(
      (known as unknown as { key: string }[]).map((k) => k.key),
    );

    let written = 0;
    let skippedUnknown = 0;
    for (const s of snapshots) {
      if (!knownSet.has(s.kpi_key)) {
        skippedUnknown++;
        continue;
      }
      await db.execute(sql`
        INSERT INTO kpi_snapshots (
          kpi_key, scope_entity_type, scope_entity_id, period_start, period_end, value, metadata
        ) VALUES (
          ${s.kpi_key},
          ${s.scope_entity_type},
          ${s.scope_entity_id ? sql`${s.scope_entity_id}::uuid` : null},
          ${s.period_start},
          ${s.period_end},
          ${s.value},
          ${s.metadata ? sql`${JSON.stringify(s.metadata)}::jsonb` : null}
        )
        ON CONFLICT (kpi_key, scope_entity_type, scope_entity_id, period_start)
        DO UPDATE SET value = EXCLUDED.value,
                      metadata = EXCLUDED.metadata,
                      computed_at = now()
      `);
      written++;
    }

    return {
      runId: ctx.run.id,
      durationMs: Date.now() - startedAt,
      computed: snapshots.length,
      written,
      skippedUnknown,
    };
  },
});
