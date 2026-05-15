import { db, schema } from '@antagna/db';
import { estimateCostUsd } from './models';

export type RecordUsageInput = {
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  userId?: string | null;
  projectId?: string | null;
};

/**
 * Record a single AI call to ai_usage.
 * Append-only — never updates an existing row.
 * D-010: open with guards, so this also returns the cost so callers can soft-cap.
 */
export async function recordUsage(input: RecordUsageInput): Promise<{ costUsd: number }> {
  const costUsd = estimateCostUsd(input.model, input.inputTokens, input.outputTokens);

  await db.insert(schema.aiUsage).values({
    feature: input.feature,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cacheReadTokens: input.cacheReadTokens ?? 0,
    cacheWriteTokens: input.cacheWriteTokens ?? 0,
    costUsd: costUsd.toFixed(6),
    userId: input.userId ?? null,
    projectId: input.projectId ?? null,
  });

  return { costUsd };
}
