import { db } from '@antagna/db';
import { sql } from 'drizzle-orm';

export interface ActivityInput {
  /** Acting profile id. The app runs service-role, so we pass it explicitly. */
  actorId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  summaryAr: string;
  summaryEn?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append a row to activity_events — the company timeline that the A4
 * memory-indexer streams into ai_memory_chunks (RAG) and the per-project
 * Activity tab reads. We INSERT with an explicit actor rather than calling the
 * write_activity() SQL function, because that function derives the actor from
 * transaction-local session GUCs which don't survive across pooled db.execute()
 * calls under the service-role connection. Best-effort: activity logging must
 * never fail the mutation it accompanies.
 */
export async function writeActivity(input: ActivityInput): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO activity_events
        (actor_id, acted_as_id, entity_type, entity_id, action,
         summary_ar, summary_en, project_id, metadata)
      VALUES (
        ${input.actorId ?? null}::uuid, ${input.actorId ?? null}::uuid,
        ${input.entityType}, ${input.entityId ?? null}::uuid, ${input.action},
        ${input.summaryAr}, ${input.summaryEn ?? null},
        ${input.projectId ?? null}::uuid, ${JSON.stringify(input.metadata ?? {})}::jsonb
      )
    `);
  } catch (e) {
    console.error('[writeActivity]', e);
  }
}
