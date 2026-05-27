/**
 * System-wide AI memory (RAG over `ai_memory_chunks`, pgvector).
 *
 * `indexMemory` embeds + stores a chunk (idempotent on source/source_id).
 * `retrieveMemory` embeds a query and returns the closest chunks by cosine
 * similarity, bumping retrieval telemetry. Importable from web + worker
 * (this package already depends on @antagna/db).
 */
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { embed } from './openai';

export interface MemoryHit {
  id: string;
  content: string;
  scope: string;
  similarity: number;
  metadata: unknown;
}

export async function retrieveMemory(opts: {
  query: string;
  scope?: string;
  scopeId?: string;
  limit?: number;
  minSimilarity?: number;
}): Promise<MemoryHit[]> {
  const { query, scope, scopeId, limit = 8, minSimilarity = 0 } = opts;
  if (!query?.trim()) return [];
  const vec = JSON.stringify(await embed(query));

  const rows = (await db.execute(sql`
    SELECT id::text AS id, content, scope, metadata,
           1 - (embedding <=> ${vec}::vector) AS similarity
    FROM ai_memory_chunks
    WHERE embedding IS NOT NULL
      ${scope ? sql`AND scope = ${scope}` : sql``}
      ${scopeId ? sql`AND scope_id = ${scopeId}::uuid` : sql``}
    ORDER BY embedding <=> ${vec}::vector
    LIMIT ${limit}
  `)) as unknown as MemoryHit[];

  const hits = rows.filter((r) => Number(r.similarity) >= minSimilarity);
  if (hits.length) {
    const ids = hits.map((h) => h.id);
    await db.execute(sql`
      UPDATE ai_memory_chunks
      SET retrieval_count = retrieval_count + 1, last_retrieved_at = now()
      WHERE id = ANY(${ids}::uuid[])
    `);
  }
  return hits;
}

export async function indexMemory(chunk: {
  scope: string;
  scopeId?: string | null;
  source: string;
  sourceId?: string | null;
  content: string;
  contentLang?: string | null;
  metadata?: unknown;
}): Promise<boolean> {
  if (!chunk.content?.trim()) return false;
  const embedding = JSON.stringify(await embed(chunk.content));
  await db.execute(sql`
    INSERT INTO ai_memory_chunks (scope, scope_id, source, source_id, content, content_lang, embedding, metadata)
    VALUES (${chunk.scope}, ${chunk.scopeId ?? null}, ${chunk.source}, ${chunk.sourceId ?? null},
            ${chunk.content}, ${chunk.contentLang ?? null}, ${embedding}::vector,
            ${JSON.stringify(chunk.metadata ?? {})}::jsonb)
    ON CONFLICT (source, source_id) DO NOTHING
  `);
  return true;
}

/** Learning-loop signal: mark a retrieved chunk as useful / not. */
export async function markChunkUseful(id: string, useful: boolean): Promise<void> {
  await db.execute(sql`UPDATE ai_memory_chunks SET useful = ${useful} WHERE id = ${id}::uuid`);
}
