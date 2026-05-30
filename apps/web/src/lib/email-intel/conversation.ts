/**
 * Cross-thread conversation analysis.
 *
 * Different from per-message email_extractions (one inbound email →
 * structured JSON) and email_threads.ai_summary (single line). This
 * looks at the FULL thread and emits:
 *   - 4-6 sentence Arabic narrative
 *   - sentiment trajectory (improving | stable | declining | mixed)
 *   - intent arc (short free-form description of how the convo evolved)
 *   - decision points (when client said yes/no/maybe, when we committed)
 *   - open items (what's still owed by whom)
 *   - outcome status (pending | won | lost | stalled)
 *
 * Idempotent on thread_id. Refreshes only when the thread has MORE
 * messages than were present at the last summary.
 */
import { db, conversationSummaries, emailThreads, emailMessages } from '@antagna/db';
import { eq, asc } from 'drizzle-orm';
import { getAnthropic, ANTHROPIC_MODELS, assertAiBudget, recordUsage } from '@antagna/ai';

const SYSTEM = `You analyze a full email thread (multiple messages) between Volt Production
(a Saudi creative agency) and a client / partner.

Read the entire conversation oldest → newest and output STRICT JSON:
{
  "summary_ar": "4-6 sentence Arabic narrative describing the conversation's arc",
  "sentiment_trajectory": "improving" | "stable" | "declining" | "mixed",
  "intent_arc": "short Arabic description of how the intent evolved (e.g. 'inquiry → quote → negotiation → tentative yes')",
  "decision_points": [
    { "at_iso": "YYYY-MM-DD or YYYY-MM-DDTHH:mm", "type": "client_said" | "we_committed" | "we_proposed" | "blocked", "what": "short Arabic" }
  ],
  "open_items": ["who owes what — short Arabic"],
  "outcome_status": "pending" | "won" | "lost" | "stalled",
  "confidence": 0..1
}

Be conservative. open_items may be empty. decision_points capped at 5.`;

export interface ConversationRunResult {
  ok: boolean;
  threadId: string;
  skipped?: 'no_thread' | 'not_enough_messages' | 'no_inbound' | 'up_to_date';
  summaryId?: string;
  error?: string;
}

export async function summarizeConversation(
  threadId: string,
): Promise<ConversationRunResult> {
  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(eq(emailThreads.id, threadId))
    .limit(1);
  if (!thread) return { ok: false, threadId, skipped: 'no_thread' };

  // Need at least 2 messages for a "conversation" to be meaningful.
  if ((thread.messageCount ?? 0) < 2) {
    return { ok: false, threadId, skipped: 'not_enough_messages' };
  }

  // Skip refresh if up-to-date.
  const [existing] = await db
    .select()
    .from(conversationSummaries)
    .where(eq(conversationSummaries.threadId, threadId))
    .limit(1);
  if (existing && existing.messageCountAtSummary >= (thread.messageCount ?? 0)) {
    return { ok: true, threadId, skipped: 'up_to_date' };
  }

  const messages = await db
    .select({
      direction: emailMessages.direction,
      fromName: emailMessages.fromName,
      fromEmail: emailMessages.fromEmail,
      bodyText: emailMessages.bodyText,
      snippet: emailMessages.snippet,
      sentAt: emailMessages.sentAt,
    })
    .from(emailMessages)
    .where(eq(emailMessages.threadId, threadId))
    .orderBy(asc(emailMessages.sentAt));

  if (messages.length === 0) {
    return { ok: false, threadId, skipped: 'no_inbound' };
  }

  // Build a compact transcript. Cap each message body, total ≤ 12k chars.
  let totalChars = 0;
  const lines: string[] = [`Subject: ${thread.subject ?? '(no subject)'}`];
  for (const m of messages) {
    const body = (m.bodyText ?? m.snippet ?? '').trim().slice(0, 1500);
    const speaker =
      m.direction === 'inbound'
        ? `↓ ${m.fromName ?? m.fromEmail}`
        : '↑ Volt';
    const line = `\n[${speaker} @ ${new Date(m.sentAt).toISOString().slice(0, 10)}]\n${body}`;
    if (totalChars + line.length > 12_000) {
      lines.push('\n[... truncated ...]');
      break;
    }
    lines.push(line);
    totalChars += line.length;
  }
  const transcript = lines.join('\n');

  await assertAiBudget({ userId: null, feature: 'email_intel_conversation' });

  const client = getAnthropic();
  let raw: string;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.haiku,
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: 'user', content: transcript }],
    });
    const txt = resp.content.find((b) => b.type === 'text');
    raw = (txt && txt.type === 'text' ? txt.text : '')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    inputTokens = resp.usage.input_tokens ?? 0;
    outputTokens = resp.usage.output_tokens ?? 0;
    await recordUsage({
      feature: 'email_intel_conversation',
      model: ANTHROPIC_MODELS.haiku,
      inputTokens,
      outputTokens,
      userId: null,
    });
  } catch (err) {
    return {
      ok: false,
      threadId,
      error: err instanceof Error ? err.message : 'anthropic_failed',
    };
  }

  let parsed: {
    summary_ar: string;
    sentiment_trajectory?: string;
    intent_arc?: string;
    decision_points?: unknown[];
    open_items?: unknown[];
    outcome_status?: string;
    confidence?: number;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, threadId, error: 'json_parse_failed' };
  }
  const confidence = Math.max(
    0,
    Math.min(1, Number(parsed.confidence ?? 0.6)),
  );

  if (existing) {
    await db
      .update(conversationSummaries)
      .set({
        messageCountAtSummary: thread.messageCount ?? messages.length,
        summaryAr: parsed.summary_ar ?? '',
        sentimentTrajectory: parsed.sentiment_trajectory ?? null,
        intentArc: parsed.intent_arc ?? null,
        decisionPoints: (parsed.decision_points ?? []) as unknown[],
        openItems: (parsed.open_items ?? []) as unknown[],
        outcomeStatus: parsed.outcome_status ?? null,
        confidence: confidence.toFixed(2),
        model: ANTHROPIC_MODELS.haiku,
        inputTokens,
        outputTokens,
        summarizedAt: new Date(),
      })
      .where(eq(conversationSummaries.id, existing.id));
    return { ok: true, threadId, summaryId: existing.id };
  } else {
    const [row] = await db
      .insert(conversationSummaries)
      .values({
        threadId,
        messageCountAtSummary: thread.messageCount ?? messages.length,
        summaryAr: parsed.summary_ar ?? '',
        sentimentTrajectory: parsed.sentiment_trajectory ?? null,
        intentArc: parsed.intent_arc ?? null,
        decisionPoints: (parsed.decision_points ?? []) as unknown[],
        openItems: (parsed.open_items ?? []) as unknown[],
        outcomeStatus: parsed.outcome_status ?? null,
        confidence: confidence.toFixed(2),
        model: ANTHROPIC_MODELS.haiku,
        inputTokens,
        outputTokens,
      })
      .returning({ id: conversationSummaries.id });
    return { ok: true, threadId, summaryId: row?.id };
  }
}
