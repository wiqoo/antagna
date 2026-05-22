import { db, schema, resolveProfileIdByAuthUser } from '@antagna/db';
import { estimateCostUsd } from './models';

export type RecordUsageInput = {
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /**
   * Pass EITHER:
   *   - userId: a profiles.id UUID (preferred when you already have it), OR
   *   - authUserId: the supabase auth.users id; we'll resolve it to a
   *     profiles.id via profiles.auth_user_id.
   *
   * ai_usage.user_id has FK → profiles.id, so passing a raw auth user id
   * here violates the constraint. If both are present, userId wins. If
   * neither resolves, the row is inserted with user_id = NULL.
   */
  userId?: string | null;
  authUserId?: string | null;
  projectId?: string | null;
};

/**
 * Record a single AI call to ai_usage.
 * Append-only — never updates an existing row.
 * D-010: open with guards, so this also returns the cost so callers can soft-cap.
 */
export async function recordUsage(input: RecordUsageInput): Promise<{ costUsd: number }> {
  const costUsd = estimateCostUsd(input.model, input.inputTokens, input.outputTokens);

  // Resolve profile id. If userId is already a profile id we trust the
  // caller; if only authUserId was passed, look up profiles.id.
  let profileId: string | null = input.userId ?? null;
  if (!profileId && input.authUserId) {
    profileId = await resolveProfileIdByAuthUser(input.authUserId);
  }

  try {
    await db.insert(schema.aiUsage).values({
      feature: input.feature,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      cacheReadTokens: input.cacheReadTokens ?? 0,
      cacheWriteTokens: input.cacheWriteTokens ?? 0,
      costUsd: costUsd.toFixed(6),
      userId: profileId,
      projectId: input.projectId ?? null,
    });
  } catch (err) {
    // If anything still trips the FK (stale impersonation, race with profile
    // deletion), fall back to inserting with user_id NULL so the AI call
    // surface doesn't 500. Cost stays tracked.
    if (
      err instanceof Error &&
      /foreign key|violates|fkey/i.test(err.message)
    ) {
      await db.insert(schema.aiUsage).values({
        feature: input.feature,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cacheReadTokens: input.cacheReadTokens ?? 0,
        cacheWriteTokens: input.cacheWriteTokens ?? 0,
        costUsd: costUsd.toFixed(6),
        userId: null,
        projectId: input.projectId ?? null,
      });
    } else {
      throw err;
    }
  }

  return { costUsd };
}
