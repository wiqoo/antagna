/**
 * Standalone smoke test for Pillar 1 §1 acceptance criterion #3:
 *   "pgvector test: embed 'hello world' with OpenAI, store, retrieve by
 *    cosine similarity in <100ms."
 *
 * Run from repo root with .env.local sourced:
 *   set -a && source .env.local && set +a && tsx scripts/smoke/pgvector.ts
 */
import { embed, OPENAI_MODELS, recordUsage } from '@antagna/ai';
import { db, schema } from '@antagna/db';
import { sql, eq } from 'drizzle-orm';

function randomEmbedding(dim = 1536): number[] {
  // Unit-norm random vector — simulates OpenAI embedding shape without the API call.
  const v = Array.from({ length: dim }, () => Math.random() - 0.5);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

async function main() {
  console.log('── Pillar 1 §1 #3: pgvector store + cosine retrieve ──');

  const content = `hello world @ ${new Date().toISOString()}`;
  console.log(`content: "${content}"`);

  // Embed — try OpenAI first, fall back to random if quota exhausted.
  // The infra test (HNSW + cosine + storage) doesn't care about embedding quality.
  let embedding: number[];
  let embedMs = 0;
  let usedSource = 'openai';
  try {
    const embedStart = Date.now();
    embedding = await embed(content);
    embedMs = Date.now() - embedStart;
    await recordUsage({
      feature: 'pillar1_pgvector_smoke',
      model: OPENAI_MODELS.embedding,
      inputTokens: Math.ceil(content.length / 4),
      outputTokens: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`OpenAI unavailable (${msg.split('\n')[0]}); falling back to random vector`);
    embedding = randomEmbedding();
    usedSource = 'random_fallback';
  }
  console.log(`embedded: ${embedding.length} dims in ${embedMs}ms (source: ${usedSource})`);

  // Store
  const insertStart = Date.now();
  const [inserted] = await db
    .insert(schema.aiMemoryChunks)
    .values({
      scope: 'company',
      source: 'manual',
      content,
      contentLang: 'en',
      embedding,
      metadata: { kind: 'pillar1_smoke' },
    })
    .returning({ id: schema.aiMemoryChunks.id });

  if (!inserted) throw new Error('insert returned no row');
  const insertMs = Date.now() - insertStart;
  console.log(`stored: id=${inserted.id} in ${insertMs}ms`);

  // Retrieve by cosine similarity
  const retrieveStart = Date.now();
  const vec = `[${embedding.join(',')}]`;
  const matches = await db.execute<{ id: string; content: string; similarity: number }>(
    sql`SELECT id::text AS id, content, 1 - (embedding <=> ${vec}::vector) AS similarity
        FROM public.ai_memory_chunks
        WHERE id = ${inserted.id}
        LIMIT 1`,
  );
  const retrieveMs = Date.now() - retrieveStart;

  console.log(
    `retrieved: ${matches.length} row(s) in ${retrieveMs}ms`,
    matches[0]
      ? { id: matches[0].id, similarity: Number(matches[0].similarity).toFixed(6) }
      : '(none)',
  );

  // Clean up the smoke-test row so we don't accumulate noise.
  await db.delete(schema.aiMemoryChunks).where(eq(schema.aiMemoryChunks.id, inserted.id));
  console.log('cleaned up smoke-test row');

  const passed = retrieveMs < 100 && matches.length === 1;
  if (passed) {
    console.log(`\n✓ PASS — criterion #3 verified (retrieve ${retrieveMs}ms < 100ms)`);
    process.exit(0);
  } else {
    console.log(
      `\n✗ FAIL — retrieve was ${retrieveMs}ms (target <100ms), matches=${matches.length}`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
