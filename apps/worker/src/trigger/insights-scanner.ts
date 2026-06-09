/**
 * Pillar 10 — Project insights scanner.
 *
 * Walks active projects, asks Claude Sonnet to flag risk (red/amber/green)
 * + suggest next action. Writes back to `projects.ai_*` columns.
 *
 * Runs every 2 hours. Skips projects analyzed within the last 1h to avoid spam.
 */
import { schedules } from '@trigger.dev/sdk';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage, checkAiBudget, retrieveMemory } from '@antagna/ai';
import { memoryIndexer } from './memory-indexer';
import { learningAggregator } from './learning-aggregator';

const SYSTEM_PROMPT = `You are Antagna's project risk analyzer.
Given a project's stage, dates, latest activity and assignments, output strict JSON:
{
  "risk": "green" | "amber" | "red",
  "status_paragraph": "<2-3 sentences Arabic>",
  "next_action": "<1 sentence Arabic — concrete action>"
}
Be conservative: amber if delivery_due in <7d and stage<editing, red if past due.`;

export const insightsScanner = schedules.task({
  id: 'insights-scanner',
  cron: '0 */2 * * *',
  maxDuration: 600,
  run: async (_payload, { ctx }) => {
    const startedAt = Date.now();

    const projects = await db.execute<{
      id: string;
      code: string;
      title: string;
      stage: string;
      delivery_due_at: Date | null;
      pm_name: string | null;
      open_tasks: number;
      blocked_tasks: number;
      activity_summary: string | null;
    }>(sql`
      SELECT
        p.id, p.code, p.title, p.stage, p.delivery_due_at,
        prof.display_name AS pm_name,
        (SELECT count(*)::int FROM project_tasks
           WHERE project_id = p.id AND status IN ('pending','in_progress')) AS open_tasks,
        (SELECT count(*)::int FROM project_tasks
           WHERE project_id = p.id AND status = 'blocked') AS blocked_tasks,
        (
          SELECT string_agg(action || ': ' || COALESCE(summary_ar, summary_en, '?'), E'\n')
          FROM (
            SELECT action, summary_ar, summary_en, created_at
            FROM activity_events
            WHERE entity_type = 'project' AND entity_id = p.id
            ORDER BY created_at DESC LIMIT 5
          ) recent
        ) AS activity_summary
      FROM projects p
      LEFT JOIN profiles prof ON prof.id = p.project_manager_id
      WHERE p.stage NOT IN ('delivered','archived','lost','cancelled')
        AND p.archived_at IS NULL
        AND (p.ai_analyzed_at IS NULL OR p.ai_analyzed_at < now() - interval '1 hour')
    `);

    const projectsArr = projects as unknown as Array<{
      id: string;
      code: string;
      title: string;
      stage: string;
      delivery_due_at: Date | null;
      pm_name: string | null;
      open_tasks: number;
      blocked_tasks: number;
      activity_summary: string | null;
    }>;

    const anthropic = getAnthropic();
    let analyzed = 0;
    let totalCostUsd = 0;

    // Hard budget gate — this loop fires Sonnet per project; bail the whole run
    // if the company monthly cap is hit (no unbounded spend).
    const budget = await checkAiBudget({ userId: null });
    if (!budget.ok) {
      console.warn('[insights-scanner] over AI budget — skipping run:', budget.reason);
      return { ok: false, skipped: 'over_budget' as const, analyzed: 0 };
    }

    for (const proj of projectsArr) {
      // Brain: read accumulated project memory so risk flags reflect history.
      let memNote = '';
      try {
        const hits = await retrieveMemory({
          query: `${proj.title} ${proj.stage} risk delay client`,
          scope: 'project',
          scopeId: proj.id,
          limit: 3,
          minSimilarity: 0.15,
        });
        if (hits.length) memNote = `\nKnown context (memory):\n${hits.map((h) => `• ${h.content.slice(0, 200)}`).join('\n')}`;
      } catch {
        /* brain optional */
      }

      const userPrompt = `Project ${proj.code} — ${proj.title}
Stage: ${proj.stage}
PM: ${proj.pm_name ?? 'unassigned'}
Delivery due: ${proj.delivery_due_at ? new Date(proj.delivery_due_at).toISOString().slice(0, 10) : 'not set'}
Open tasks: ${proj.open_tasks} (${proj.blocked_tasks} blocked)
Recent activity:
${proj.activity_summary ?? '(none in last events)'}${memNote}

Output JSON only.`;

      try {
        const resp = await anthropic.messages.create({
          model: ANTHROPIC_MODELS.sonnet,
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const text = resp.content.find((b) => b.type === 'text');
        const raw = text && text.type === 'text' ? text.text : '{}';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn(`[insights-scanner] no JSON in response for ${proj.code}`);
          continue;
        }
        const parsed = JSON.parse(jsonMatch[0]) as {
          risk: string;
          status_paragraph: string;
          next_action: string;
        };

        const { costUsd } = await recordUsage({
          feature: 'insights_scanner',
          model: ANTHROPIC_MODELS.sonnet,
          inputTokens: resp.usage.input_tokens,
          outputTokens: resp.usage.output_tokens,
          userId: null,
        });
        totalCostUsd += costUsd;

        await db.execute(sql`
          UPDATE projects
          SET ai_risk_level = ${parsed.risk},
              ai_status_paragraph = ${parsed.status_paragraph},
              ai_next_action = ${parsed.next_action},
              ai_analyzed_at = now(),
              updated_at = now()
          WHERE id = ${proj.id}::uuid
        `);

        analyzed++;
      } catch (err) {
        console.error(`[insights-scanner] failed for ${proj.code}:`, err);
      }
    }

    // Refresh the system AI memory after analysis (fire-and-forget).
    await memoryIndexer.trigger({}).catch((e) =>
      console.error('[insights-scanner] memory-indexer trigger failed', e),
    );
    // Roll suggestion-review decisions into learnings (fire-and-forget).
    await learningAggregator.trigger({}).catch((e) =>
      console.error('[insights-scanner] learning-aggregator trigger failed', e),
    );

    // Piggyback the deadline notifier (same 2-h cadence, keeps us under the
    // Trigger.dev Pro 10-schedule cap). Fan-out via /api/internal/notify.
    let deadlineSummary: { items: number; fanned: number } | { skipped: string } = {
      skipped: 'not_run',
    };
    try {
      const { runDeadlineNotifier } = await import('./deadline-notifier');
      deadlineSummary = await runDeadlineNotifier();
    } catch (err) {
      console.error('[insights-scanner] deadline-notifier failed:', err);
    }

    return {
      ranId: ctx.run.id,
      durationMs: Date.now() - startedAt,
      eligible: projectsArr.length,
      analyzed,
      totalCostUsd,
    };
  },
});
