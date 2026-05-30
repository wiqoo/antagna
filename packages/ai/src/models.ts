/**
 * Single source of truth for AI model strings (D-020).
 * NEVER hand-write a model name elsewhere — import from here.
 */

export const ANTHROPIC_MODELS = {
  /** Heaviest reasoning: complex planning, ambiguity, multi-step. */
  opus: 'claude-opus-4-6',
  /** Default production model: chat, drafts, structured output. */
  sonnet: 'claude-sonnet-4-6',
  /** Background / batch / classification — cheap and fast. */
  haiku: 'claude-haiku-4-5-20251001',
} as const;

export const OPENAI_MODELS = {
  /** Embeddings (1536-dim) — locked per D-008 for memory chunks. */
  embedding: 'text-embedding-3-small',
  /** Whisper transcription — optional (meeting notes). */
  whisper: 'whisper-1',
} as const;

export type AnthropicModel = (typeof ANTHROPIC_MODELS)[keyof typeof ANTHROPIC_MODELS];
export type OpenAiModel = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS];

/** Per-million-token prices (USD), used by the cost guard. Keep in sync with Anthropic + OpenAI pricing. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  [ANTHROPIC_MODELS.opus]: { input: 15, output: 75 },
  [ANTHROPIC_MODELS.sonnet]: { input: 3, output: 15 },
  [ANTHROPIC_MODELS.haiku]: { input: 0.8, output: 4 },
  [OPENAI_MODELS.embedding]: { input: 0.02, output: 0 },
  // Off-policy but still in use by the WhatsApp bot + email-intel (flagged for a
  // D-020 model-policy decision). Priced so the cost ledger + budget guard see
  // real spend instead of $0.
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = MODEL_PRICING[model];
  if (!price) return 0;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
