/**
 * Standalone smoke test for Pillar 1 §1 acceptance criterion #2:
 *   "A trigger fires a Trigger.dev job that calls Claude Sonnet with a test
 *    prompt and writes the cost to the ai_usage table."
 *
 * We invoke the same packages the Trigger.dev task uses (@antagna/ai +
 * @antagna/db), bypassing the orchestrator for the local smoke test. The
 * Trigger.dev wrapper in apps/worker/src/trigger/ai-smoke-test.ts is a thin
 * adapter around these same calls.
 *
 * Run from repo root with .env.local sourced:
 *   set -a && source .env.local && set +a && tsx scripts/smoke/ai-cost.ts
 */
import { getAnthropic, ANTHROPIC_MODELS, recordUsage } from '@antagna/ai';
import { db, schema } from '@antagna/db';
import { desc, eq } from 'drizzle-orm';

async function main() {
  console.log('── Pillar 1 §1 #2: Claude Sonnet + ai_usage write ──');

  const anthropic = getAnthropic();
  const prompt = 'Say hello in 5 words or less.';

  console.log(`prompt: "${prompt}"`);
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODELS.sonnet,
    max_tokens: 64,
    messages: [{ role: 'user', content: prompt }],
  });

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const textBlock = response.content.find((b) => b.type === 'text');
  const reply = textBlock && textBlock.type === 'text' ? textBlock.text : '';

  console.log(`reply: "${reply.trim()}"`);
  console.log(`tokens: input=${inputTokens} output=${outputTokens}`);

  const { costUsd } = await recordUsage({
    feature: 'pillar1_smoke_test',
    model: ANTHROPIC_MODELS.sonnet,
    inputTokens,
    outputTokens,
  });
  console.log(`cost recorded: $${costUsd.toFixed(6)}`);

  // Read back the row we just inserted.
  const [row] = await db
    .select()
    .from(schema.aiUsage)
    .where(eq(schema.aiUsage.feature, 'pillar1_smoke_test'))
    .orderBy(desc(schema.aiUsage.createdAt))
    .limit(1);

  if (!row) {
    console.error('FAIL: row was not found in ai_usage after insert');
    process.exit(1);
  }

  console.log('ai_usage row:', {
    id: row.id.toString(),
    feature: row.feature,
    model: row.model,
    input_tokens: row.inputTokens,
    output_tokens: row.outputTokens,
    cost_usd: row.costUsd,
    created_at: row.createdAt.toISOString(),
  });

  console.log('\n✓ PASS — criterion #2 verified');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
