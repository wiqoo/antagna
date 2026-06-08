import OpenAI from 'openai';
import { OPENAI_MODELS } from './models';
import { recordUsage } from './cost';

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  _client = new OpenAI({ apiKey });
  return _client;
}

/**
 * Embed a single chunk of text into the 1536-dim vector used by ai_memory_chunks.
 * Every embed records its token spend to ai_usage (feature-tagged) so ALL brain
 * cost is visible to the budget guard — pass a `feature` to attribute it.
 */
export async function embed(text: string, feature = 'embedding'): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: OPENAI_MODELS.embedding,
    input: text,
  });
  const first = response.data[0];
  if (!first) throw new Error('OpenAI embeddings returned empty array');
  // Best-effort cost ledger — never let usage tracking break embedding.
  recordUsage({
    feature,
    model: OPENAI_MODELS.embedding,
    inputTokens: response.usage?.total_tokens ?? 0,
    outputTokens: 0,
    userId: null,
  }).catch(() => {});
  return first.embedding;
}
