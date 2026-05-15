import OpenAI from 'openai';
import { OPENAI_MODELS } from './models';

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  _client = new OpenAI({ apiKey });
  return _client;
}

/** Embed a single chunk of text into the 1536-dim vector used by ai_memory_chunks. */
export async function embed(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: OPENAI_MODELS.embedding,
    input: text,
  });
  const first = response.data[0];
  if (!first) throw new Error('OpenAI embeddings returned empty array');
  return first.embedding;
}
