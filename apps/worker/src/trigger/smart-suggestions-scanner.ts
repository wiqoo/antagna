/**
 * Pillar 10/11 — proactive "smart suggestions" feed.
 *
 * Regular task (NOT a schedule — Trigger.dev Pro caps us at 10 schedules
 * and the daily brief already runs at 07:30 Asia/Riyadh, so we piggyback
 * by triggering this task from `daily-brief` at the end of its run).
 *
 * Each opportunity becomes an ai_suggestion of type 'escalate_to_human'
 * with metadata in proposed_data so the queue can render it correctly.
 *
 * Sources:
 *   - Threads in "awaiting_their_reply" > 5 days → suggest follow-up
 *   - Hot leads (high temperature) untouched > 48h → suggest contact
 *   - Project delivery_due_at within 3 days, stage < editing → risk flag
 *   - Stalled conversation_summaries (outcome_status='stalled') → suggest recall
 */
import { task } from '@trigger.dev/sdk';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

type AnyRow = Record<string, unknown>;

export const smartSuggestionsScanner = task({
  id: 'smart-suggestions-scanner',
  maxDuration: 180,
  run: async (_payload: Record<string, never>, { ctx }) => {
    const startedAt = Date.now();
    let inserted = 0;

    // 1) Awaiting_their_reply > 5 days → suggest follow-up
    const stale = (await db.execute<AnyRow>(sql`
      SELECT thread_id::text AS thread_id, subject,
             hours_since_last_outbound::float AS hours
      FROM v_email_communication_metrics
      WHERE reply_state = 'awaiting_their_reply'
        AND hours_since_last_outbound > 120
      ORDER BY hours_since_last_outbound DESC
      LIMIT 20
    `)) as unknown as AnyRow[];
    for (const r of stale) {
      const summary = `متابعة: عميل ما رد عليك من ${Math.round(
        (r.hours as number) / 24,
      )} يوم على "${(r.subject as string) ?? '(thread)'}"`;
      inserted += await ensureSuggestion({
        sourceThreadId: r.thread_id as string,
        type: 'escalate_to_human',
        summary,
        confidence: 0.75,
        data: {
          type: 'escalate_to_human',
          reason: 'awaiting_their_reply_too_long',
          subject: r.subject,
          hours_since_last_outbound: r.hours,
        },
        dedupeKey: `followup:${r.thread_id}`,
      });
    }

    // 2) Hot leads untouched > 48h
    const cold = (await db.execute<AnyRow>(sql`
      SELECT l.id::text AS lead_id, l.code, l.unmatched_from_email,
             l.unmatched_from_name, l.temperature_score,
             EXTRACT(EPOCH FROM (now() - l.received_at)) / 3600.0 AS hours
      FROM leads l
      WHERE l.status NOT IN ('won','lost','disqualified')
        AND l.lost_at IS NULL
        AND COALESCE(l.temperature_score, 0) >= 50
        AND l.received_at < now() - interval '48 hours'
      ORDER BY l.temperature_score DESC, l.received_at ASC
      LIMIT 10
    `)) as unknown as AnyRow[];
    for (const r of cold) {
      const summary = `Lead ساخن مهمل: ${r.code} (${r.unmatched_from_name ?? r.unmatched_from_email}) — منذ ${Math.round(
        (r.hours as number) / 24,
      )} يوم`;
      inserted += await ensureSuggestion({
        type: 'escalate_to_human',
        summary,
        confidence: 0.7,
        data: {
          type: 'escalate_to_human',
          reason: 'hot_lead_going_cold',
          lead_id: r.lead_id,
          code: r.code,
          temperature_score: r.temperature_score,
        },
        dedupeKey: `lead_cold:${r.lead_id}`,
      });
    }

    // 3) Project delivery within 3 days, stage < 'editing'
    const atRisk = (await db.execute<AnyRow>(sql`
      SELECT p.id::text AS project_id, p.code, p.title,
             p.stage::text AS stage,
             EXTRACT(EPOCH FROM (p.delivery_due_at - now())) / 86400.0 AS days_left
      FROM projects p
      WHERE p.archived_at IS NULL
        AND p.delivery_due_at IS NOT NULL
        AND p.delivery_due_at < now() + interval '3 days'
        AND p.stage NOT IN ('editing','review','delivered','archived','lost','cancelled')
      ORDER BY p.delivery_due_at ASC
      LIMIT 10
    `)) as unknown as AnyRow[];
    for (const r of atRisk) {
      const days = (r.days_left as number) ?? 0;
      const summary = `مشروع في خطر: ${r.code} "${r.title}" — تسليم خلال ${days.toFixed(1)} يوم، الحالة ${r.stage}`;
      inserted += await ensureSuggestion({
        type: 'escalate_to_human',
        summary,
        confidence: 0.8,
        data: {
          type: 'escalate_to_human',
          reason: 'project_delivery_at_risk',
          project_id: r.project_id,
          code: r.code,
          stage: r.stage,
          days_until_delivery: days,
        },
        dedupeKey: `project_risk:${r.project_id}`,
      });
    }

    // 4) Stalled conversations from cross-thread summaries
    const stalled = (await db.execute<AnyRow>(sql`
      SELECT cs.thread_id::text AS thread_id, t.subject,
             cs.summary_ar, cs.summarized_at::text AS summarized_at
      FROM conversation_summaries cs
      JOIN email_threads t ON t.id = cs.thread_id
      WHERE cs.outcome_status = 'stalled'
      ORDER BY cs.summarized_at DESC
      LIMIT 5
    `)) as unknown as AnyRow[];
    for (const r of stalled) {
      const summary = `محادثة متوقفة: "${(r.subject as string) ?? ''}" — راجع وقرّر متابعة أو إغلاق`;
      inserted += await ensureSuggestion({
        sourceThreadId: r.thread_id as string,
        type: 'escalate_to_human',
        summary,
        confidence: 0.65,
        data: {
          type: 'escalate_to_human',
          reason: 'conversation_stalled',
          summary_ar: r.summary_ar,
        },
        dedupeKey: `stalled:${r.thread_id}`,
      });
    }

    return {
      runId: ctx.run.id,
      durationMs: Date.now() - startedAt,
      inserted,
    };
  },
});

interface EnsureInput {
  type: string;
  summary: string;
  confidence: number;
  data: Record<string, unknown>;
  dedupeKey: string;
  sourceThreadId?: string;
}

/**
 * Insert an ai_suggestion IF no pending one with the same dedupe key
 * exists. Returns 1 if inserted, 0 if deduped.
 */
async function ensureSuggestion(input: EnsureInput): Promise<number> {
  const data = { ...input.data, _dedupe_key: input.dedupeKey };

  const existing = (await db.execute<{ id: string }>(sql`
    SELECT id::text AS id FROM ai_suggestions
    WHERE proposed_data ->> '_dedupe_key' = ${input.dedupeKey}
      AND status IN ('pending', 'approved')
      AND expires_at > now()
    LIMIT 1
  `)) as unknown as Array<{ id: string }>;
  if (existing.length > 0) return 0;

  await db.execute(sql`
    INSERT INTO ai_suggestions (
      source_type, source_thread_id, suggestion_type,
      proposed_data, summary_ar, confidence
    ) VALUES (
      'system',
      ${input.sourceThreadId ?? null}::uuid,
      ${input.type}::ai_suggestion_type,
      ${JSON.stringify(data)}::jsonb,
      ${input.summary},
      ${input.confidence.toFixed(2)}::numeric
    )
  `);
  return 1;
}
