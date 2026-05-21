import { task } from '@trigger.dev/sdk';
import { embed, OPENAI_MODELS, recordUsage } from '@antagna/ai';
import { db, schema } from '@antagna/db';
import { sql } from 'drizzle-orm';

/**
 * Pillar 1 §1 success criterion #3:
 *   "pgvector test: embed 'hello world' with OpenAI, store, retrieve by
 *    cosine similarity in <100ms."
 */
export const embeddingSmokeTest = task({
  id: 'embedding-smoke-test',
  maxDuration: 30,
  run: async (payload: { content?: string }) => {
    const content = payload.content ?? 'hello world';

    const start = Date.now();
    const embedding = await embed(content);
    const embedMs = Date.now() - start;

    // Cost: rough token estimate (1 token ≈ 4 chars).
    await recordUsage({
      feature: 'embedding_smoke_test',
      model: OPENAI_MODELS.embedding,
      inputTokens: Math.ceil(content.length / 4),
      outputTokens: 0,
    });

    // Insert into ai_memory_chunks.
    const [inserted] = await db
      .insert(schema.aiMemoryChunks)
      .values({
        scope: 'company',
        source: 'manual',
        content,
        contentLang: 'en',
        embedding,
        metadata: { kind: 'smoke_test' },
      })
      .returning({ id: schema.aiMemoryChunks.id });

    if (!inserted) throw new Error('Insert returned no row');

    // Retrieve by cosine similarity.
    const retrieveStart = Date.now();
    const matches = await db.execute(sql`
      SELECT id, content, 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
      FROM ai_memory_chunks
      WHERE id = ${inserted.id}
      LIMIT 1
    `);
    const retrieveMs = Date.now() - retrieveStart;

    return {
      content,
      embeddingDimensions: embedding.length,
      embedMs,
      retrieveMs,
      retrievedRowCount: matches.length,
      meetsAcceptanceCriterion: retrieveMs < 100,
    };
  },
});
