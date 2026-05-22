/**
 * Deep extraction — turns one inbound email message into a structured
 * ExtractedEmail JSON via OpenAI (gpt-4o-mini default).
 *
 * Idempotent on email_messages.id — email_extractions.message_id has a
 * UNIQUE constraint so the upsert just rewrites the row.
 */
import { db, emailMessages, emailThreads, emailExtractions } from '@antagna/db';
import { eq, sql } from 'drizzle-orm';
import { getOpenAI } from '@antagna/ai';
import type { ExtractedEmail } from './types';

const MODEL = process.env.EMAIL_INTEL_MODEL ?? 'gpt-4o-mini';

const SYSTEM = `You extract structured data from a single business email for Volt Production
(Saudi creative agency, Jeddah). Output STRICT JSON matching the schema, no prose.

Be conservative: fields you can't confirm should be null/empty array.
Dates are ISO-8601 (YYYY-MM-DD or full timestamp). Money in SAR as a number.

Schema (TypeScript):
{
  language: 'ar' | 'en' | 'mixed',
  intent: 'new_inquiry' | 'project_update' | 'meeting_request' | 'complaint'
        | 'follow_up' | 'invoice' | 'introduction' | 'thank_you' | 'other',
  sender: {
    name: string | null,
    company: string | null,
    role: string | null,
    email: string,
    phone: string | null
  },
  project_signals: {
    is_new_project: boolean,
    existing_project_hints: string[],
    project_type: 'shoot' | 'edit' | 'campaign' | 'consulting' | 'other' | null,
    proposed_title_ar: string | null,
    proposed_title_en: string | null
  },
  dates: {
    shoot_dates_iso: string[],
    delivery_deadline_iso: string | null,
    meeting_proposed_at_iso: string | null
  },
  budget: {
    amount_sar: number | null,
    range: '10-25k' | '25-50k' | '50-100k' | '100k+' | null,
    is_estimate: boolean
  },
  deliverables: Array<{
    format: 'reel' | 'short' | 'long' | 'photo' | 'print' | 'other',
    count: number,
    duration_sec: number | null,
    platform: string | null
  }>,
  mentioned_people: Array<{ name: string, role: string | null }>,
  mentioned_companies: string[],
  action_items: Array<{
    description: string,
    owner_hint: string | null,
    due_iso: string | null
  }>,
  sentiment: 'positive' | 'neutral' | 'concerned' | 'angry',
  urgency: 'low' | 'medium' | 'high',
  reply_needed: boolean,
  summary_ar: string,    // 2-3 line Arabic summary for queue cards
  confidence: number     // 0-1, your own confidence in the extraction
}`;

export interface ExtractionRunResult {
  ok: boolean;
  messageId: string;
  extractionId?: string;
  data?: ExtractedEmail;
  error?: string;
}

export async function extractEmail(
  messageDbId: string,
): Promise<ExtractionRunResult> {
  const [msg] = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.id, messageDbId))
    .limit(1);
  if (!msg) return { ok: false, messageId: messageDbId, error: 'not_found' };

  // Only extract inbound business-y messages — outbound/marketing/spam
  // shouldn't burn tokens.
  if (msg.direction !== 'inbound') {
    return { ok: false, messageId: messageDbId, error: 'not_inbound' };
  }

  const [thread] = await db
    .select({ subject: emailThreads.subject, topicTags: emailThreads.aiTopicTags })
    .from(emailThreads)
    .where(eq(emailThreads.id, msg.threadId))
    .limit(1);

  // Skip if AI already classified as junk on the lightweight pass.
  const tags = thread?.topicTags ?? [];
  if (
    tags.includes('category:marketing') ||
    tags.includes('category:spam') ||
    tags.includes('category:notification') ||
    tags.includes('category:automated')
  ) {
    return { ok: false, messageId: messageDbId, error: 'junk_category' };
  }

  // Cap the body to ~8k chars — most business emails fit easily.
  const body = (msg.bodyText ?? msg.snippet ?? '').trim().slice(0, 8000);
  if (body.length < 5) {
    return { ok: false, messageId: messageDbId, error: 'body_too_short' };
  }

  const userPrompt = `Subject: ${msg.subject ?? thread?.subject ?? '(none)'}
From: ${msg.fromName ?? ''} <${msg.fromEmail}>
Sent: ${new Date(msg.sentAt).toISOString()}

${body}`;

  const client = getOpenAI();
  let raw: string;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const resp = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    });
    raw = resp.choices[0]?.message?.content ?? '{}';
    inputTokens = resp.usage?.prompt_tokens ?? 0;
    outputTokens = resp.usage?.completion_tokens ?? 0;
  } catch (err) {
    return {
      ok: false,
      messageId: messageDbId,
      error: err instanceof Error ? err.message : 'openai_failed',
    };
  }

  let data: ExtractedEmail;
  try {
    data = JSON.parse(raw) as ExtractedEmail;
  } catch (err) {
    return { ok: false, messageId: messageDbId, error: 'json_parse_failed' };
  }
  const confidence = Math.max(0, Math.min(1, Number(data.confidence ?? 0.5)));

  // gpt-4o-mini: $0.15/Mtok input, $0.60/Mtok output
  const costUsd =
    (inputTokens * 0.15 + outputTokens * 0.6) / 1_000_000;

  const [row] = await db
    .insert(emailExtractions)
    .values({
      threadId: msg.threadId,
      messageId: msg.id,
      data: data as unknown as Record<string, unknown>,
      confidence: confidence.toFixed(2),
      model: MODEL,
      inputTokens,
      outputTokens,
      costUsd: costUsd.toFixed(6),
    })
    .onConflictDoUpdate({
      target: emailExtractions.messageId,
      set: {
        data: data as unknown as Record<string, unknown>,
        confidence: confidence.toFixed(2),
        model: MODEL,
        inputTokens,
        outputTokens,
        costUsd: costUsd.toFixed(6),
        extractedAt: sql`now()`,
      },
    })
    .returning({ id: emailExtractions.id });

  return {
    ok: true,
    messageId: messageDbId,
    extractionId: row?.id,
    data,
  };
}
