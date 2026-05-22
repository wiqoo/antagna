/**
 * Pillar 10 — Daily brief generator.
 *
 * Runs each morning at 07:30 Asia/Riyadh, generates an AI summary for each
 * active project + each person, writes to `daily_briefs`. Notifications are
 * fanned out by `notify_daily_brief` via NOTIFY (Pillar 8 worker reads it).
 */
import { schedules } from '@trigger.dev/sdk';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage } from '@antagna/ai';
import { smartSuggestionsScanner } from './smart-suggestions-scanner';

const SYSTEM_PROMPT = `You are Antagna's daily brief generator for a Saudi production agency.
Output 3-5 sentences in Arabic about what changed yesterday, what blocks today,
and what to ship. Be specific. Reference project codes and people by name.
Output Arabic only — no English fillers.`;

export const dailyBrief = schedules.task({
  id: 'daily-brief',
  cron: '30 4 * * *', // 04:30 UTC = 07:30 Asia/Riyadh
  maxDuration: 600,
  run: async (_payload, { ctx }) => {
    const startedAt = Date.now();

    const projects = await db.execute<{
      id: string;
      code: string;
      title: string;
      stage: string;
      pm_name: string | null;
      activity_summary: string;
    }>(sql`
      SELECT
        p.id, p.code, p.title, p.stage,
        prof.display_name AS pm_name,
        (
          SELECT string_agg(
            ae.action || ': ' || COALESCE(ae.summary_ar, ae.summary_en, '?'),
            E'\n'
            ORDER BY ae.created_at DESC
          )
          FROM activity_events ae
          WHERE ae.entity_type = 'project'
            AND ae.entity_id = p.id
            AND ae.created_at > now() - interval '24 hours'
        ) AS activity_summary
      FROM projects p
      LEFT JOIN profiles prof ON prof.id = p.project_manager_id
      WHERE p.stage NOT IN ('delivered','archived','lost','cancelled')
        AND p.archived_at IS NULL
    `);

    const anthropic = getAnthropic();
    const projectsArr = projects as unknown as Array<{
      id: string;
      code: string;
      title: string;
      stage: string;
      pm_name: string | null;
      activity_summary: string;
    }>;

    let briefsCount = 0;
    let totalCostUsd = 0;

    for (const proj of projectsArr) {
      if (!proj.activity_summary) continue;

      const userPrompt = `Project: ${proj.code} — ${proj.title}
Stage: ${proj.stage}
PM: ${proj.pm_name ?? 'unassigned'}

Activity last 24h:
${proj.activity_summary}`;

      try {
        const resp = await anthropic.messages.create({
          model: ANTHROPIC_MODELS.sonnet,
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const text = resp.content.find((b) => b.type === 'text');
        const briefText = text && text.type === 'text' ? text.text : '';

        const { costUsd } = await recordUsage({
          feature: 'daily_brief',
          model: ANTHROPIC_MODELS.sonnet,
          inputTokens: resp.usage.input_tokens,
          outputTokens: resp.usage.output_tokens,
          userId: null,
        });
        totalCostUsd += costUsd;

        await db.execute(sql`
          INSERT INTO daily_briefs (scope, scope_entity_id, brief_date, brief_text, model_used, cost_usd)
          VALUES (
            'project',
            ${proj.id}::uuid,
            current_date,
            ${briefText},
            ${ANTHROPIC_MODELS.sonnet},
            ${costUsd}
          )
          ON CONFLICT (scope, scope_entity_id, brief_date) DO UPDATE
            SET brief_text = EXCLUDED.brief_text,
                model_used = EXCLUDED.model_used,
                cost_usd = EXCLUDED.cost_usd,
                generated_at = now()
        `);

        briefsCount++;
      } catch (err) {
        console.error(`[daily-brief] failed for ${proj.code}:`, err);
      }
    }

    // Piggyback: fan out the smart-suggestions scan once briefs are
    // generated (kept as a regular task to stay under Trigger.dev's
    // 10-schedule cap on Pro).
    try {
      await smartSuggestionsScanner.trigger({});
    } catch (err) {
      console.error('[daily-brief] failed to trigger smart-suggestions:', err);
    }

    return {
      ranId: ctx.run.id,
      durationMs: Date.now() - startedAt,
      projectsConsidered: projectsArr.length,
      briefsCount,
      totalCostUsd,
    };
  },
});
