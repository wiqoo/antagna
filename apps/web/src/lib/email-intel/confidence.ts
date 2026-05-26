/**
 * A4 learning loop — read side.
 *
 * The `learning-aggregator` worker writes per-type acceptance rates into
 * project_learnings (learning_type = 'suggestion_acceptance:<type>'). This
 * reads them and nudges a suggestion's effective confidence toward what humans
 * actually keep, so the propose→approve tiers (CONFIDENCE_THRESHOLDS) adapt
 * without a redeploy. Bounded (±0.10) and gated behind a sample floor, so an
 * early noisy signal can't flip automation. Human-in-the-loop by design: the
 * loop re-weights review tiers, it never auto-executes on its own.
 *
 * Wire-in point: the suggestion tiering in /inbox (Phase B2) calls
 * adjustConfidence() before comparing against CONFIDENCE_THRESHOLDS.
 */
import { db } from '@antagna/db';
import { sql } from 'drizzle-orm';
import type { SuggestionType } from './types';

const SAMPLE_FLOOR = 10; // below this many decisions, don't adjust at all
const SAMPLE_FULL = 40; // at/above this, the (still bounded) weight is full
const MAX_DELTA = 0.1; // never move confidence by more than this

export interface LearnedRate {
  rate: number; // 0..1 human acceptance
  sampleSize: number;
}

/** Learned acceptance rate for a suggestion type (null if absent or too sparse). */
export async function learnedAcceptanceRate(
  type: SuggestionType,
): Promise<LearnedRate | null> {
  const rows = (await db.execute(sql`
    SELECT confidence::float8 AS rate, sample_size AS sample
    FROM project_learnings
    WHERE scope = 'general'
      AND learning_type = ${'suggestion_acceptance:' + type}
      AND active = true
    LIMIT 1
  `)) as unknown as { rate: number; sample: number }[];
  const r = rows[0];
  if (!r || r.sample < SAMPLE_FLOOR) return null;
  return { rate: r.rate, sampleSize: r.sample };
}

/** Blend a base confidence with a learned acceptance rate (bounded, safe). */
export function blendConfidence(base: number, learned: LearnedRate | null): number {
  if (!learned) return base;
  const weight = Math.min(learned.sampleSize, SAMPLE_FULL) / SAMPLE_FULL; // 0..1
  // rate > 0.5 → humans keep these → allow a touch more confidence.
  // rate < 0.5 → humans reject these → pull confidence back.
  const delta = (learned.rate - 0.5) * 2 * MAX_DELTA * weight; // [-MAX_DELTA, +MAX_DELTA]
  return Math.max(0, Math.min(1, base + delta));
}

/** Fetch + blend in one server-side call. */
export async function adjustConfidence(
  type: SuggestionType,
  base: number,
): Promise<number> {
  return blendConfidence(base, await learnedAcceptanceRate(type));
}
