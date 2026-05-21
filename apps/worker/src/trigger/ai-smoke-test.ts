import { task } from '@trigger.dev/sdk';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage } from '@antagna/ai';

/**
 * Pillar 1 §1 success criterion #2:
 *   "A trigger fires a Trigger.dev job that calls Claude Sonnet with a test
 *    prompt and writes the cost to the ai_usage table."
 *
 * Run with: `npx trigger.dev@latest dev` then trigger this job from the dashboard,
 * or via SDK from the web app.
 */
export const aiSmokeTest = task({
  id: 'ai-smoke-test',
  maxDuration: 60,
  run: async (payload: { prompt?: string; userId?: string }) => {
    const anthropic = getAnthropic();
    const prompt = payload.prompt ?? 'Say hello in 5 words or less.';

    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 64,
      messages: [{ role: 'user', content: prompt }],
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    const { costUsd } = await recordUsage({
      feature: 'ai_smoke_test',
      model: ANTHROPIC_MODELS.sonnet,
      inputTokens,
      outputTokens,
      userId: payload.userId ?? null,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const replyText = textBlock && textBlock.type === 'text' ? textBlock.text : '';

    return {
      reply: replyText,
      model: response.model,
      inputTokens,
      outputTokens,
      costUsd,
    };
  },
});
