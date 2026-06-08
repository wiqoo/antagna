/**
 * Deep extraction — turns one inbound email CONVERSATION into a structured
 * ExtractedEmail JSON via Claude Sonnet (Anthropic).
 *
 * Idempotent on email_messages.id — email_extractions.message_id has a
 * UNIQUE constraint so the upsert just rewrites the row.
 *
 * Pass `userId` (a profiles.id) when a human triggers this (e.g. the /intake
 * "تحليل أعمق" action) so the per-user AI budget caps engage; the background
 * sync path leaves it null (company-budget guard only).
 */
import { db, emailMessages, emailThreads, emailExtractions } from '@antagna/db';
import { eq, sql } from 'drizzle-orm';
import { getAnthropic, ANTHROPIC_MODELS, assertAiBudget, recordUsage, retrieveMemory, indexMemory } from '@antagna/ai';
import type { ExtractedEmail } from './types';
import {
  processMessageAttachments,
  getAttachmentTextForMessage,
} from './attachments';

const SYSTEM = `You are the senior intake analyst at Volt Production (Saudi creative/production agency, Jeddah).
You are given a FULL business email CONVERSATION — EVERY message in the thread, attachment text, and signatures.
Read ALL of it like an experienced account manager and produce a DEEP, structured brief. Output STRICT JSON matching the schema, no prose.

GO DEEP. Don't just copy lines — reason about the engagement:
- What does the client actually want, for whom, and why? What is the real scope behind the words?
- Synthesize across messages + attachments; resolve contradictions to the LATEST intent.
- Pull every concrete fact worth knowing into key_details (audience, language ar/en, shoot location/city, platforms, video durations/aspect ratios, brand/product, references, quantity, recurring vs one-off, event date).
- Capture reference links / drive folders / decks into reference_links.

Your most important job is to identify WHO THE CLIENT IS and WHO THE CONTACT IS:
- "sender" = the main EXTERNAL person we deal with in this thread (usually the latest inbound writer). Fill name, email, phone, and especially:
  - sender.company = the CLIENT organization this person represents (who the work is for / who would pay). It is NEVER "Volt Production" (that's us) and NEVER a free email provider (gmail/hotmail/…). Infer it from their email signature, their domain, and how they speak.
  - sender.role = their job title — take it from the email SIGNATURE when present.
- Read signatures + attachments to get company, role and phone right.
- decision_makers = the people who APPROVE or PAY (CEO, marketing manager, procurement) — pulled from signatures/CC/how people defer to each other.
- mentioned_companies / mentioned_people = OTHER organizations/people referenced.

THINK LIKE A PM PREPARING TO START THE JOB:
- brief_ar = a tight 3–6 line Arabic brief of the actual ask: what, for whom, deliverables, timing, any creative direction.
- scope_items = concrete pieces of work requested (e.g. "ريلز ٣٠ ثانية ×٥", "تصوير منتج", "موشن جرافيك").
- missing_info = ONLY genuinely-absent facts we need to START — phrased as SHORT ARABIC QUESTIONS. STRICT RULES: (a) each item must correspond to something that is null/empty in THIS extraction (e.g. ask about budget ONLY if budget.amount_sar is null; ask about the deadline ONLY if dates.delivery_deadline_iso is null; ask about deliverables ONLY if deliverables is empty). (b) NEVER ask about anything already stated anywhere in the thread or attachments. (c) If everything needed to start is present, return an EMPTY array — do NOT invent questions to fill space. Max 6 items.
- next_step_ar = the single best next action for us, grounded in the thread (e.g. "إرسال عرض سعر", "تأكيد موعد التصوير", "طلب الأصول من العميل"). If unclear, return "".

BUSINESS LINE — who owns this work? Volt produces two streams:
  (1) EXTERNAL CLIENT work — a paying brand/agency (BMW, CEER, لكزس, an agency…). This is the DEFAULT.
  (2) "محتوى أبو لوكا" — Abu Luka (أبو لوكا) is a creator/personality whose OWN personal brand & channels Volt also produces. This is content FOR HIM, not for an external paying client.
Set is_abu_luka_content = true ONLY when the thread is clearly about producing Abu Luka's own personal/brand content (his channels, his persona, his personal projects), or the counterpart IS Abu Luka coordinating his own content. Otherwise false. Put a one-line Arabic justification in business_line_reason.

Be conservative: fields you can't confirm = null/empty array. Cap lists: scope_items ≤ 10, key_details ≤ 12. Do NOT fabricate.
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
  confidence: number,    // 0-1, your own confidence in the extraction

  // Deeper intake intelligence — fill these thoughtfully:
  brief_ar: string,                                          // 3-6 line Arabic brief of the real ask/scope
  scope_items: string[],                                     // concrete work items requested (Arabic)
  key_details: Array<{ label: string, value: string }>,      // any concrete fact worth knowing (label in Arabic)
  decision_makers: Array<{ name: string, role: string | null }>,
  missing_info: string[],                                    // critical unknowns to start — short Arabic questions
  next_step_ar: string,                                      // single best next action (Arabic)
  reference_links: string[],                                 // URLs / drive folders / decks found
  is_abu_luka_content: boolean,                              // true ONLY for Abu Luka's own personal/brand content (default false)
  business_line_reason: string                               // one short Arabic line justifying the business-line call
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
  opts: { userId?: string | null } = {},
): Promise<ExtractionRunResult> {
  const userId = opts.userId ?? null;
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
    .select({ subject: emailThreads.subject, topicTags: emailThreads.aiTopicTags, clientId: emailThreads.clientId })
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

  // userId set → per-user daily/monthly hard caps engage (manual reanalyze);
  // null → company-monthly budget only (background sync). assertAiBudget throws
  // AiBudgetError on cap-exceeded — callers must catch it.
  await assertAiBudget({ userId, feature: 'email_intel_extract' });

  // Brain: after the budget gate (so the embedding never precedes it), pull what
  // we already know about this client to sharpen the extraction.
  let memContext = '';
  if (thread?.clientId) {
    try {
      const hits = await retrieveMemory({
        query: `${thread.subject ?? msg.subject ?? ''} ${msg.fromName ?? ''} ${msg.fromEmail}`,
        scope: 'client',
        scopeId: thread.clientId,
        limit: 4,
        minSimilarity: 0.15,
      });
      if (hits.length) {
        memContext = `\n\n──── What we already know about this client (memory) ────\n${hits.map((h) => `• ${h.content.slice(0, 240)}`).join('\n')}`;
      }
    } catch {
      /* brain is optional context */
    }
  }

  const client = getAnthropic();
  let raw: string;
  let inputTokens = 0;
  let outputTokens = 0;
  let truncated = false;
  try {
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 4096,
      // Large stable system prompt behind a prompt-cache breakpoint → every
      // call after the first in a sync loop reads it at ~10% the cost. SDK
      // types don't expose cache_control yet, hence the `as any` (mirrors
      // gmail-summarize.ts).
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      messages: [{ role: 'user', content: userPrompt + memContext }],
    });
    truncated = resp.stop_reason === 'max_tokens';
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
      cacheReadTokens:
        (resp.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
      cacheWriteTokens:
        (resp.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
      userId,
    });
  } catch (err) {
    return {
      ok: false,
      messageId: messageDbId,
      error: err instanceof Error ? err.message : 'anthropic_failed',
    };
  }

  // Tolerant parse: strip any prose around the JSON object (the model may
  // prepend reasoning), then parse. If the response was truncated at the token
  // cap the object is unterminated → JSON.parse fails; surface that explicitly.
  let data: ExtractedEmail;
  try {
    data = JSON.parse(raw) as ExtractedEmail;
  } catch {
    const braced = raw.match(/\{[\s\S]*\}/);
    if (braced) {
      try {
        data = JSON.parse(braced[0]) as ExtractedEmail;
      } catch {
        return {
          ok: false,
          messageId: messageDbId,
          error: truncated ? 'truncated_response' : 'json_parse_failed',
        };
      }
    } else {
      return {
        ok: false,
        messageId: messageDbId,
        error: truncated ? 'truncated_response' : 'json_parse_failed',
      };
    }
  }
  const confidence = Math.max(0, Math.min(1, Number(data.confidence ?? 0.5)));

  // Claude Sonnet 4.6: $3/Mtok input, $15/Mtok output (display only — the
  // budget ledger uses recordUsage's MODEL_PRICING table).
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
        model: ANTHROPIC_MODELS.sonnet,
        inputTokens,
        outputTokens,
        costUsd: costUsd.toFixed(6),
        extractedAt: sql`now()`,
      },
    })
    .returning({ id: emailExtractions.id });

  // Brain write-back: store the structured conclusion so future analysis of this
  // client (and the quotation/dashboard surfaces) reuses it. Best-effort.
  if (thread?.clientId) {
    const company = data.sender?.company ?? data.sender?.name ?? '—';
    const proj = data.project_signals?.proposed_title_ar ? ` — مشروع محتمل: ${data.project_signals.proposed_title_ar}` : '';
    indexMemory({
      scope: 'client',
      scopeId: thread.clientId,
      source: 'email_extraction',
      sourceId: msg.id,
      content: `بريد من ${company}: ${data.summary_ar ?? ''}${proj}`,
      contentLang: 'ar',
      metadata: { intent: data.intent, urgency: data.urgency },
    }).catch(() => {});
  }

  return {
    ok: true,
    messageId: messageDbId,
    extractionId: row?.id,
    data,
  };
}
