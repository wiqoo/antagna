/**
 * A4 — Learning loop aggregator.
 *
 * Rolls up the `ai_action_log` decisions that A3 writes on every suggestion
 * review (feature='suggestion_review') into durable `project_learnings`:
 * per suggestion_type acceptance rate + sample size. The app's
 * `adjustConfidence()` helper (lib/email-intel/confidence.ts) reads these to
 * nudge the propose→approve thresholds toward what humans actually accept —
 * a human-in-the-loop feedback loop, not a black box.
 *
 * Regular task (not a schedule — Trigger.dev Pro 10-schedule cap); triggered
 * from insights-scanner's tail. Idempotent: it UPDATEs the existing learning
 * row per type, INSERTing only the first time.
 */
import { task } from '@trigger.dev/sdk';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

const MIN_SAMPLE = 5; // ignore types with too few decisions to be meaningful

type Row = {
  suggestion_type: string;
  total: number;
  accepted: number;
};

export const learningAggregator = task({
  id: 'learning-aggregator',
  maxDuration: 120,
  run: async (_payload: { force?: boolean } = {}) => {
    // Acceptance per type: accepted/executed/edited count as "kept" (the human
    // ran with it, possibly after a tweak); rejected/ignored count as "dropped".
    const rows = (await db.execute(sql`
      SELECT
        metadata->>'suggestion_type' AS suggestion_type,
        count(*)::int AS total,
        count(*) FILTER (
          WHERE outcome IN ('accepted', 'executed', 'edited')
        )::int AS accepted
      FROM ai_action_log
      WHERE feature = 'suggestion_review'
        AND metadata->>'suggestion_type' IS NOT NULL
      GROUP BY 1
    `)) as unknown as Row[];

    let upserted = 0;
    for (const r of rows) {
      if (!r.suggestion_type || r.total < MIN_SAMPLE) continue;
      const rate = Math.round((r.accepted / r.total) * 100) / 100; // 0.00–1.00
      const learningType = `suggestion_acceptance:${r.suggestion_type}`;
      const insightAr = `معدل قبول اقتراحات «${r.suggestion_type}» هو ${Math.round(
        rate * 100,
      )}% عبر ${r.total} مراجعة.`;
      const insightEn = `Humans keep ${Math.round(rate * 100)}% of "${
        r.suggestion_type
      }" suggestions across ${r.total} reviews.`;

      const updated = (await db.execute(sql`
        UPDATE project_learnings
        SET confidence = ${rate}, sample_size = ${r.total},
            insight_ar = ${insightAr}, insight_en = ${insightEn},
            created_at = now()
        WHERE scope = 'general' AND learning_type = ${learningType} AND active = true
        RETURNING id
      `)) as unknown as { id: string }[];

      if (updated.length === 0) {
        await db.execute(sql`
          INSERT INTO project_learnings
            (scope, learning_type, insight_ar, insight_en, confidence, sample_size, active)
          VALUES ('general', ${learningType}, ${insightAr}, ${insightEn},
                  ${rate}, ${r.total}, true)
        `);
      }
      upserted++;
    }

    return { typesConsidered: rows.length, learningsUpserted: upserted };
  },
});
