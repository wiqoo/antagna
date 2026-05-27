/**
 * A4 — System AI memory indexer.
 *
 * Embeds recent `audit_log` (backfill) + `activity_events` (go-forward) rows
 * into `ai_memory_chunks` so the AI can recall everything that happens
 * (RAG via @antagna/ai retrieveMemory). High-water mark = max indexed source_id
 * per source (ids are ascending bigints). Idempotent via the (source,source_id)
 * unique index. Regular task — triggered from insights-scanner's tail to stay
 * under the Trigger.dev schedule cap.
 */
import { task } from '@trigger.dev/sdk';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { indexMemory, OPENAI_MODELS, recordUsage } from '@antagna/ai';

type AuditRow = { id: string; action: string; entity_type: string | null; summary: string | null };
type ActivityRow = { id: string; action: string; entity_type: string | null; project_id: string | null; summary: string | null };

async function highWater(source: string): Promise<bigint> {
  const r = (await db.execute(sql`
    SELECT COALESCE(MAX(source_id::bigint), 0) AS mark
    FROM ai_memory_chunks WHERE source = ${source}
  `)) as unknown as { mark: string }[];
  return BigInt(r[0]?.mark ?? '0');
}

export const memoryIndexer = task({
  id: 'memory-indexer',
  maxDuration: 600,
  run: async (payload: { batch?: number } = {}) => {
    const batch = payload.batch ?? 150;
    let indexed = 0;
    let chars = 0;

    // 1) audit_log backfill (4k+ rows; catches up over runs)
    const auditMark = await highWater('audit_log');
    const audit = (await db.execute(sql`
      SELECT id::text AS id, action, entity_type, summary
      FROM audit_log WHERE id > ${auditMark.toString()}::bigint
      ORDER BY id LIMIT ${batch}
    `)) as unknown as AuditRow[];
    for (const a of audit) {
      const content = `[${a.entity_type ?? 'system'}] ${a.action}${a.summary ? ': ' + a.summary : ''}`.trim();
      chars += content.length;
      await indexMemory({
        scope: a.entity_type ?? 'company', source: 'audit_log', sourceId: a.id,
        content, metadata: { action: a.action, entity_type: a.entity_type },
      });
      indexed++;
    }

    // 2) activity_events go-forward
    const actMark = await highWater('activity_event');
    const acts = (await db.execute(sql`
      SELECT id::text AS id, action, entity_type, project_id::text AS project_id,
             COALESCE(summary_ar, summary_en) AS summary
      FROM activity_events WHERE id > ${actMark.toString()}::bigint
      ORDER BY id LIMIT ${batch}
    `)) as unknown as ActivityRow[];
    for (const e of acts) {
      const content = `[${e.entity_type ?? 'system'}] ${e.action}${e.summary ? ': ' + e.summary : ''}`.trim();
      chars += content.length;
      await indexMemory({
        scope: e.project_id ? 'project' : (e.entity_type ?? 'company'),
        scopeId: e.project_id, source: 'activity_event', sourceId: e.id,
        content, metadata: { action: e.action, entity_type: e.entity_type },
      });
      indexed++;
    }

    if (indexed > 0) {
      await recordUsage({
        feature: 'memory_indexer',
        model: OPENAI_MODELS.embedding,
        inputTokens: Math.ceil(chars / 4),
        outputTokens: 0,
      });
    }
    return { indexed, auditBackfilled: audit.length, activityIndexed: acts.length };
  },
});
