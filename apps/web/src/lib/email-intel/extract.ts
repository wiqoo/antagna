/**
 * Deep extraction — turns one inbound email message into a structured
 * ExtractedEmail JSON via Claude Haiku (Anthropic).
 *
 * Idempotent on email_messages.id — email_extractions.message_id has a
 * UNIQUE constraint so the upsert just rewrites the row.
 */
import { db, emailMessages, emailThreads, emailExtractions } from '@antagna/db';
import { eq, sql } from 'drizzle-orm';
import { getAnthropic, ANTHROPIC_MODELS, assertAiBudget, recordUsage } from '@antagna/ai';
import type { ExtractedEmail } from './types';
import {
  processMessageAttachments,
  getAttachmentTextForMessage,
} from './attachments';

const SYSTEM = `You extract structured data from a FULL business email CONVERSATION for Volt Production
(Saudi creative agency, Jeddah). You are given EVERY message in the thread, the attachment text, and signatures. Read ALL of it. Output STRICT JSON matching the schema, no prose.

Your most important job is to identify WHO THE CLIENT IS and WHO THE CONTACT IS:
- "sender" = the main EXTERNAL person we deal with in this thread (usually the latest inbound writer). Fill name, email, phone, and especially:
  - sender.company = the CLIENT organization this person represents (who the work is for / who would pay). It is NEVER "Volt Production" (that's us) and NEVER a free email provider (gmail/hotmail/…). Infer it from their email signature, their domain, and how they speak.
  - sender.role = their job title — take it from the email SIGNATURE when present.
- Read signatures + attachments to get company, role and phone right.
- mentioned_companies / mentioned_people = OTHER organizations/people referenced.

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

  // Read the FULL conversation (all messages, oldest→newest) so the model can
  // reason about who the client/contact really is — not just the latest line.
  const threadMsgs = await db
    .select({
      id: emailMessages.id,
      direction: emailMessages.direction,
      fromName: emailMessages.fromName,
      fromEmail: emailMessages.fromEmail,
      bodyText: emailMessages.bodyText,
      snippet: emailMessages.snippet,
      sentAt: emailMessages.sentAt,
    })
    .from(emailMessages)
    .where(eq(emailMessages.threadId, msg.threadId))
    .orderBy(emailMessages.sentAt);

  // Parse the target message's attachments, then gather attachment text across
  // the WHOLE thread (read-only) so contracts/briefs in any message are seen.
  if ((msg.attachmentCount ?? 0) > 0) {
    try {
      await processMessageAttachments(msg.id);
    } catch {
      // best-effort
    }
  }
  const attachmentChunks: string[] = [];
  for (const tm of threadMsgs) {
    try {
      const at = await getAttachmentTextForMessage(tm.id);
      if (at) attachmentChunks.push(at);
    } catch {
      // best-effort
    }
  }
  const attachmentText = attachmentChunks.length
    ? attachmentChunks.join('\n\n').slice(0, 24_000)
    : null;

  // Transcript keeps each body up to 4000 chars so SIGNATURES (at the end)
  // survive; whole transcript capped at 16k.
  const transcript = threadMsgs
    .map((tm) => {
      const who =
        tm.direction === 'outbound' ? 'Volt (us)' : `${tm.fromName ?? ''} <${tm.fromEmail}>`;
      const when = tm.sentAt
        ? new Date(tm.sentAt).toISOString().slice(0, 16).replace('T', ' ')
        : '';
      const dir = tm.direction === 'inbound' ? '↓ IN' : '↑ OUT';
      return `[${dir} ${when}] ${who}:\n${(tm.bodyText ?? tm.snippet ?? '').trim().slice(0, 4000)}`;
    })
    .join('\n\n')
    .slice(0, 16_000);

  if (transcript.trim().length < 5 && !attachmentText) {
    return { ok: false, messageId: messageDbId, error: 'body_too_short' };
  }

  const userPrompt = `Subject: ${thread?.subject ?? msg.subject ?? '(none)'}
Latest inbound from: ${msg.fromName ?? ''} <${msg.fromEmail}>

──── Conversation (oldest → newest) ────
${transcript}${attachmentText ? `\n\n──── Attachments (across the thread) ────\n${attachmentText}` : ''}`;

  await assertAiBudget({ userId: null, feature: 'email_intel_extract' });

  const client = getAnthropic();
  let raw: string;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const txt = resp.content.find((b) => b.type === 'text');
    raw = (txt && txt.type === 'text' ? txt.text : '')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    if (!raw) raw = '{}';
    inputTokens = resp.usage.input_tokens ?? 0;
    outputTokens = resp.usage.output_tokens ?? 0;
    await recordUsage({
      feature: 'email_intel_extract',
      model: ANTHROPIC_MODELS.sonnet,
      inputTokens,
      outputTokens,
      userId: null,
    });
  } catch (err) {
    return {
      ok: false,
      messageId: messageDbId,
      error: err instanceof Error ? err.message : 'anthropic_failed',
    };
  }

  let data: ExtractedEmail;
  try {
    data = JSON.parse(raw) as ExtractedEmail;
  } catch (err) {
    return { ok: false, messageId: messageDbId, error: 'json_parse_failed' };
  }
  const confidence = Math.max(0, Math.min(1, Number(data.confidence ?? 0.5)));

  // Claude Sonnet 4.6: $3/Mtok input, $15/Mtok output
  const costUsd =
    (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  const [row] = await db
    .insert(emailExtractions)
    .values({
      threadId: msg.threadId,
      messageId: msg.id,
      data: data as unknown as Record<string, unknown>,
      confidence: confidence.toFixed(2),
      model: ANTHROPIC_MODELS.sonnet,
      inputTokens,
      outputTokens,
      costUsd: costUsd.toFixed(6),
    })
    .onConflictDoUpdate({
      target: emailExtractions.messageId,
      set: {
        data: data as unknown as Record<string, unknown>,
        confidence: confidence.toFixed(2),
        model: ANTHROPIC_MODELS.haiku,
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
