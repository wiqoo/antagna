'use server';

import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage } from '@antagna/ai';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const BRIEFING_SYSTEM = `You are Antagna's daily briefing assistant for Mohammed Ghareeb,
Director of Production at Volt Production (Saudi automotive content agency, Jeddah).

Given a structured operational snapshot (today's date + counts + key items),
output STRICT JSON only:

{
  "headline": "<one Arabic sentence summarizing the day in 8-12 words>",
  "bullets": [
    {
      "priority": "high" | "medium" | "low",
      "text": "<Arabic sentence — what's happening, why it matters>",
      "action": "<Arabic sentence — concrete next action>",
      "link": "<optional internal link like /projects/UUID>"
    }
  ],
  "mood": "calm" | "busy" | "critical"
}

Rules:
- 3-6 bullets max. Quality > quantity.
- Lead with the most critical (overdue deliveries, blocked items, capacity overflows).
- End with leads/CRM if relevant.
- If everything is fine, say so with a "calm" mood and 2-3 bullets.
- Be direct, not corporate. Mohammed wants signal not fluff.
- Output JSON only.`;

export type Briefing = {
  headline: string;
  bullets: Array<{
    priority: 'high' | 'medium' | 'low';
    text: string;
    action: string;
    link?: string;
  }>;
  mood: 'calm' | 'busy' | 'critical';
  generated_at: string;
};

export async function generateBriefing(): Promise<
  { ok: true; briefing: Briefing } | { ok: false; error: string }
> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  // Pull a snapshot of today's operational state
  const snapshotRes = (await db.execute<{ snapshot: string }>(sql`
    WITH
      overdue AS (
        SELECT count(*)::int AS n,
               json_agg(json_build_object(
                 'code', code, 'title', COALESCE(title_ar, title),
                 'days_overdue', (now()::date - delivery_due_at::date),
                 'link', '/projects/' || id::text
               )) AS items
        FROM projects
        WHERE delivery_due_at IS NOT NULL
          AND delivery_due_at < now()
          AND stage NOT IN ('delivered','archived','lost','cancelled')
      ),
      pending_review AS (
        SELECT count(*)::int AS n
        FROM deliverables
        WHERE status IN ('pending_director','pending_am','in_client_review')
      ),
      shoots_this_week AS (
        SELECT count(*)::int AS n,
               json_agg(json_build_object(
                 'code', p.code,
                 'title', COALESCE(p.title_ar, p.title),
                 'date', p.shoot_starts_at::date::text,
                 'link', '/projects/' || p.id::text
               )) AS items
        FROM projects p
        WHERE p.shoot_starts_at IS NOT NULL
          AND p.shoot_starts_at >= now()
          AND p.shoot_starts_at < now() + interval '7 days'
      ),
      cold_leads AS (
        SELECT count(*)::int AS n
        FROM leads
        WHERE status IN ('new','qualified','nurturing')
          AND received_at < now() - interval '5 days'
      ),
      blocked_tasks AS (
        SELECT count(*)::int AS n
        FROM project_tasks
        WHERE status = 'blocked'
      ),
      stage_stuck AS (
        SELECT count(*)::int AS n,
               json_agg(json_build_object(
                 'code', code,
                 'stage', stage::text,
                 'days', (now()::date - updated_at::date),
                 'link', '/projects/' || id::text
               )) AS items
        FROM projects
        WHERE archived_at IS NULL
          AND (
            (stage = 'brief'  AND updated_at < now() - interval '3 days') OR
            (stage = 'quoted' AND updated_at < now() - interval '5 days') OR
            (stage = 'editing' AND updated_at < now() - interval '7 days')
          )
      ),
      equipment_conflicts AS (
        SELECT count(*)::int AS n FROM (
          SELECT equipment_id, count(*) AS overlap
          FROM equipment_reservations r1
          WHERE equipment_id IS NOT NULL
            AND status != 'cancelled'
            AND starts_at >= now() - interval '1 day'
            AND starts_at < now() + interval '14 days'
            AND EXISTS (
              SELECT 1 FROM equipment_reservations r2
              WHERE r2.equipment_id = r1.equipment_id
                AND r2.id != r1.id
                AND r2.status != 'cancelled'
                AND r2.starts_at < r1.ends_at
                AND r2.ends_at > r1.starts_at
            )
          GROUP BY equipment_id
        ) c
      ),
      team_load AS (
        SELECT json_agg(json_build_object(
          'name', display_name,
          'load', load_count
        )) AS items
        FROM (
          SELECT p.display_name, count(*)::int AS load_count
          FROM profiles p
          INNER JOIN project_assignments pa ON pa.profile_id = p.id
          INNER JOIN projects pr ON pr.id = pa.project_id
          WHERE pr.stage NOT IN ('delivered','archived','lost','cancelled')
          GROUP BY p.id, p.display_name
          HAVING count(*) >= 3
          ORDER BY load_count DESC
          LIMIT 3
        ) t
      )
    SELECT json_build_object(
      'today',         to_char(now(), 'YYYY-MM-DD Day'),
      'overdue',       (SELECT row_to_json(o) FROM overdue o),
      'pending_review',(SELECT n FROM pending_review),
      'shoots_this_week', (SELECT row_to_json(s) FROM shoots_this_week s),
      'cold_leads',    (SELECT n FROM cold_leads),
      'blocked_tasks', (SELECT n FROM blocked_tasks),
      'stage_stuck',   (SELECT row_to_json(s) FROM stage_stuck s),
      'equipment_conflicts', (SELECT n FROM equipment_conflicts),
      'team_load',     (SELECT row_to_json(t) FROM team_load t)
    )::text AS snapshot
  `)) as unknown as Array<{ snapshot: string }>;

  const snapshot = snapshotRes[0]?.snapshot ?? '{}';

  try {
    const anthropic = getAnthropic();
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 1200,
      system: BRIEFING_SYSTEM,
      messages: [{ role: 'user', content: `Operational snapshot:\n${snapshot}` }],
    });
    await recordUsage({
      feature: 'daily_briefing',
      model: ANTHROPIC_MODELS.sonnet,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
      authUserId: user.id,
    });

    const text = resp.content.find((b) => b.type === 'text');
    const raw = text && text.type === 'text' ? text.text : '{}';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, error: 'no_json' };

    const parsed = JSON.parse(match[0]) as Omit<Briefing, 'generated_at'>;

    // Cache the briefing per user (one row per day, upserts on regen).
    const [actor] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.authUserId, user.id))
      .limit(1);

    if (actor) {
      await db.execute(sql`
        INSERT INTO daily_briefs (profile_id, brief_date, content, highlights)
        VALUES (
          ${actor.id}::uuid,
          to_char(now(), 'YYYY-MM-DD'),
          ${parsed.headline},
          ${JSON.stringify(parsed)}::jsonb
        )
        ON CONFLICT (profile_id, brief_date) DO UPDATE
          SET content = EXCLUDED.content,
              highlights = EXCLUDED.highlights,
              generated_at = now()
      `);
    }

    revalidatePath('/dashboard');
    return {
      ok: true,
      briefing: { ...parsed, generated_at: new Date().toISOString() },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

export async function loadCachedBriefing(): Promise<Briefing | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (!actor) return null;

  const rows = (await db.execute<{
    highlights: Record<string, unknown>;
    generated_at: Date;
  }>(sql`
    SELECT highlights, generated_at
    FROM daily_briefs
    WHERE profile_id = ${actor.id}::uuid
      AND brief_date = to_char(now(), 'YYYY-MM-DD')
    ORDER BY generated_at DESC
    LIMIT 1
  `)) as unknown as Array<{ highlights: Record<string, unknown>; generated_at: Date }>;

  const row = rows[0];
  if (!row || !row.highlights) return null;
  try {
    return {
      ...(row.highlights as unknown as Omit<Briefing, 'generated_at'>),
      generated_at: new Date(row.generated_at).toISOString(),
    };
  } catch {
    return null;
  }
}
