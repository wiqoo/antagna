/**
 * Email thread summarizer.
 *
 * For each thread whose ai_summary is stale (NULL, or older than the latest
 * message), we ask Claude Haiku to produce:
 *   - 2-3 line Arabic summary
 *   - topic tags (free-form), including encoded category + urgency:
 *       category:business | marketing | spam | internal | notification | automated
 *       urgency:low | medium | high
 *       needs_reply | no_reply_needed
 *   - per-message suggested actions on the most recent inbound message
 *
 * The reply-state itself ("did we reply?") is derived from
 * last_inbound_at vs last_outbound_at — that's a SQL fact, not an AI guess.
 * AI only decides whether the thread *needs* a reply.
 */
import { db, emailThreads, emailMessages } from '@antagna/db';
import { eq, isNull, or, sql, desc, and } from 'drizzle-orm';
import { getAnthropic, ANTHROPIC_MODELS, assertAiBudget, recordUsage, retrieveMemory } from '@antagna/ai';
import { applyRoutingAndLinking } from './gmail-routing';
import { extractMeetingNotes } from './meeting-notes';
import { extractEmail } from './email-intel/extract';
import { generateSuggestionsForExtraction } from './email-intel/generate';
import { summarizeConversation } from './email-intel/conversation';

export interface SummarizeReport {
  startedAt: string;
  finishedAt: string;
  eligibleThreads: number;
  summarizedThreads: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  threadsAutoClosed: number;
  threadsLinkedToClient: number;
  leadsCreated: number;
  meetingNotesExtracted: number;
  deepExtractions: number;
  suggestionsGenerated: number;
  errors: { threadId: string; error: string }[];
}

export interface SummarizeOptions {
  /** Cap on threads to summarize per run (cost guard). */
  maxThreads?: number;
}

const SYSTEM_PROMPT = `You are Antagna's email thread classifier for Volt Production, a Saudi creative agency.

Given a thread (subject + the FULL message history, inbound ↓ and outbound ↑) output STRICT JSON only — no prose:
{
  "summary_ar": "<2-3 sentences in Arabic, plain text. Lead with who + what + decision needed>",
  "category": "business" | "marketing" | "spam" | "internal" | "notification" | "automated",
  "urgency": "low" | "medium" | "high",
  "needs_reply": true | false,
  "reply_status": "needs_reply" | "no_reply_needed" | "awaiting_them" | "handled_off_channel",
  "urgent": true | false,
  "urgent_reason": "<short Arabic phrase, ONLY when urgent>",
  "topic_tags": ["..."],
  "suggested_actions": [
    { "type": "reply" | "create_lead" | "link_to_project" | "archive" | "follow_up" | "ignore",
      "reason": "<short Arabic>" }
  ]
}

reply_status — compare the LAST inbound (↓) vs the LAST outbound (↑):
- needs_reply: the last message is inbound, expects something from us, and we have NOT answered it.
- awaiting_them: we already replied (↑ is last, or our reply answered them); the ball is in their court.
- no_reply_needed: nothing to answer — auto-confirmation, newsletter, thank-you, or a "no-reply" / out-of-office / automated SIGNATURE.
- handled_off_channel: a note below says there was recent WhatsApp/phone contact with this client that likely handled the matter.
Read the SIGNATURE of the latest message: a "no-reply"/automated/out-of-office signature ⇒ usually no_reply_needed.
urgent: true ONLY when it must be handled within ~1 hour (angry client, a deadline within the hour, an operational emergency). Otherwise false. urgent_reason: one short Arabic phrase, only when urgent.

Categories:
- business: real client/partner conversations, RFPs, project work
- marketing: newsletters, promos, mailing-list blasts → no_reply_needed
- spam: phishing, scams, payment-failed scams
- internal: team-to-team comms
- notification: automated system emails (Calendar invites, Google Docs share, GitHub, etc.)
- automated: receipts, confirmations, auto-replies

Rules:
- If category is marketing/spam/notification/automated → needs_reply is almost always false.
- topic_tags should be short, lowercase, in English (e.g. "byd", "tqm", "subscription", "rfp", "meeting"). Include client/brand names where obvious.
- Be conservative with "high" urgency — only for time-sensitive business with explicit deadlines.`;

interface ClaudeResponse {
  summary_ar: string;
  category: string;
  urgency: string;
  needs_reply: boolean;
  reply_status?: string;
  urgent?: boolean;
  urgent_reason?: string;
  topic_tags: string[];
  suggested_actions: { type: string; reason: string }[];
}

const REPLY_STATUSES = new Set(['needs_reply', 'no_reply_needed', 'awaiting_them', 'handled_off_channel']);

// Map the summarizer's category/urgency onto the inbox TRIAGE columns
// (category/importance, migration 058) so classification is AUTOMATIC on every
// summarize run — no separate manual click. The summarizer reads the FULL
// transcript (all messages, ~6k chars), so this is a higher-quality signal than
// the old header-only manual classifier.
const TRIAGE_CATEGORY: Record<string, string> = {
  business: 'actionable',
  internal: 'actionable',
  marketing: 'marketing',
  spam: 'spam',
  notification: 'notification',
  automated: 'notification',
};
const NOISE_TRIAGE = new Set(['marketing', 'newsletter', 'spam']);

function mapTriage(
  category: string,
  urgency: string,
  hasOutbound: boolean,
): { triageCategory: string; importance: string } {
  let triageCategory = TRIAGE_CATEGORY[String(category).toLowerCase()] ?? 'actionable';
  // Safety guard: if WE have already replied in this thread it's a real
  // conversation — never hide it as noise even if the model leaned that way.
  // This is the #1 fix for "real client mail getting buried".
  if (hasOutbound && NOISE_TRIAGE.has(triageCategory)) triageCategory = 'actionable';
  const importance = ['low', 'medium', 'high'].includes(String(urgency).toLowerCase())
    ? String(urgency).toLowerCase()
    : 'low';
  return { triageCategory, importance };
}

export async function summarizeThreads(
  options: SummarizeOptions = {},
): Promise<SummarizeReport> {
  const startedAt = new Date().toISOString();
  const maxThreads = options.maxThreads ?? 30;

  const report: SummarizeReport = {
    startedAt,
    finishedAt: '',
    eligibleThreads: 0,
    summarizedThreads: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedCostUsd: 0,
    threadsAutoClosed: 0,
    threadsLinkedToClient: 0,
    leadsCreated: 0,
    meetingNotesExtracted: 0,
    deepExtractions: 0,
    suggestionsGenerated: 0,
    errors: [],
  };

  // Threads needing summary: no summary yet, or summary older than latest message.
  const eligible = await db
    .select({
      id: emailThreads.id,
      subject: emailThreads.subject,
      lastMessageAt: emailThreads.lastMessageAt,
      clientId: emailThreads.clientId,
      projectId: emailThreads.projectId,
    })
    .from(emailThreads)
    .where(
      or(
        isNull(emailThreads.aiSummary),
        // Also pick up threads that were summarized before auto-triage existed
        // (category still NULL) so they get classified automatically over the
        // next few worker runs — no manual button needed.
        isNull(emailThreads.category),
        sql`${emailThreads.aiSummaryUpdatedAt} IS NULL OR ${emailThreads.lastMessageAt} > ${emailThreads.aiSummaryUpdatedAt}`,
      ),
    )
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(maxThreads);

  report.eligibleThreads = eligible.length;

  // Cost guard (worker context → no session, so userId: null; the company-wide
  // monthly budget still applies). One check before the per-thread loop, which
  // can fire up to ~maxThreads Anthropic calls. If a hard cap is hit we stop
  // the run gracefully and return a report that records why nothing ran.
  try {
    await assertAiBudget({ userId: null, feature: 'gmail_summarize' });
  } catch (err) {
    report.errors.push({
      threadId: '',
      error: `budget_stop: ${err instanceof Error ? err.message : String(err)}`,
    });
    report.finishedAt = new Date().toISOString();
    return report;
  }

  const anthropic = getAnthropic();

  for (const thread of eligible) {
    try {
      // Fetch messages for the thread, oldest → newest.
      const msgs = await db
        .select({
          direction: emailMessages.direction,
          fromName: emailMessages.fromName,
          fromEmail: emailMessages.fromEmail,
          subject: emailMessages.subject,
          bodyText: emailMessages.bodyText,
          snippet: emailMessages.snippet,
          sentAt: emailMessages.sentAt,
          id: emailMessages.id,
        })
        .from(emailMessages)
        .where(eq(emailMessages.threadId, thread.id))
        .orderBy(emailMessages.sentAt);

      if (msgs.length === 0) continue;

      // Build a compact transcript. Bound total body to ~6k chars.
      let totalChars = 0;
      const lines: string[] = [`Subject: ${thread.subject ?? '(no subject)'}`];
      for (const m of msgs) {
        const body =
          (m.bodyText ?? m.snippet ?? '').trim().replace(/\s+/g, ' ').slice(0, 800);
        const from = m.fromName ? `${m.fromName} <${m.fromEmail}>` : m.fromEmail;
        const line = `\n[${m.direction === 'inbound' ? '↓ IN' : '↑ OUT'}] ${from} @ ${new Date(m.sentAt).toISOString().slice(0, 10)}\n${body}`;
        if (totalChars + line.length > 6000) {
          lines.push('\n[...truncated...]');
          break;
        }
        lines.push(line);
        totalChars += line.length;
      }
      const transcript = lines.join('\n');

      // Cross-channel awareness: was there recent WhatsApp contact with this
      // client/project? If so, the matter may have been handled off-email —
      // tell the model so it can mark handled_off_channel instead of needs_reply.
      let crossChannelNote = '';
      if (thread.clientId || thread.projectId) {
        try {
          const wa = await db.execute(sql`
            SELECT max(received_at) AS last_at, count(*)::int AS n
            FROM whatsapp_messages wm
            WHERE wm.received_at >= now() - interval '3 days'
              AND (
                ${thread.projectId ? sql`wm.project_id = ${thread.projectId}::uuid` : sql`false`}
                OR (${thread.clientId ? sql`wm.matched_contact_id IN (SELECT id FROM contacts WHERE client_id = ${thread.clientId}::uuid)` : sql`false`})
              )
          `);
          const row = (wa as unknown as Array<{ last_at: string | null; n: number }>)[0];
          if (row && Number(row.n) > 0 && row.last_at) {
            crossChannelNote =
              `\n\n[ملاحظة قناة أخرى] يوجد ${row.n} رسالة واتساب حديثة مع هذا العميل/المشروع (آخرها ${new Date(row.last_at).toISOString().slice(0, 16).replace('T', ' ')}). قد يكون الأمر عولج عبر الواتساب.`;
          }
        } catch {
          // best-effort
        }
      }

      // Brain: prepend what we already know about this client so the summary +
      // classification reflect the relationship, not just this thread.
      let memNote = '';
      if (thread.clientId) {
        try {
          const hits = await retrieveMemory({
            query: thread.subject ?? '',
            scope: 'client',
            scopeId: thread.clientId,
            limit: 3,
            minSimilarity: 0.2,
          });
          if (hits.length) memNote = `\n\n[ذاكرة العميل]\n${hits.map((h) => `• ${h.content.slice(0, 200)}`).join('\n')}`;
        } catch {
          // brain optional
        }
      }

      const resp = await anthropic.messages.create({
        model: ANTHROPIC_MODELS.haiku,
        max_tokens: 500,
        // Long stable system prompt goes behind a prompt-cache breakpoint so
        // every call after the first in this loop reads it at 10% the cost.
        // `cache_control` is accepted by the API but the SDK type defs don't
        // expose it yet — `as any` keeps us on the prompt-caching path (mirrors
        // inbox/actions.ts).
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
        messages: [{ role: 'user', content: transcript + crossChannelNote + memNote }],
      });

      report.totalInputTokens += resp.usage.input_tokens;
      report.totalOutputTokens += resp.usage.output_tokens;

      await recordUsage({
        feature: 'gmail_summarize',
        model: ANTHROPIC_MODELS.haiku,
        inputTokens: resp.usage.input_tokens,
        outputTokens: resp.usage.output_tokens,
        cacheReadTokens:
          (resp.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
        cacheWriteTokens:
          (resp.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
      });

      const textBlock = resp.content.find((b) => b.type === 'text');
      const raw =
        textBlock && textBlock.type === 'text' ? textBlock.text : '{}';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        report.errors.push({
          threadId: thread.id,
          error: 'no JSON in response',
        });
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]) as ClaudeResponse;

      // Encode category/urgency/needs_reply into topic_tags too — the schema
      // doesn't have separate columns and tags are flexible enough.
      const allTags = Array.from(
        new Set([
          ...(parsed.topic_tags ?? []),
          `category:${parsed.category}`,
          `urgency:${parsed.urgency}`,
          parsed.needs_reply ? 'needs_reply' : 'no_reply_needed',
        ]),
      );

      // AUTO-TRIAGE: derive the dedicated category/importance columns the inbox
      // filter relies on, right here in the automatic summarize pass.
      const hasOutbound = msgs.some((m) => m.direction === 'outbound');
      const { triageCategory, importance } = mapTriage(
        parsed.category,
        parsed.urgency,
        hasOutbound,
      );

      // Smart reply-need + urgency (migration 069). Default reply_status from
      // needs_reply when the model omits it.
      const replyStatus = REPLY_STATUSES.has(String(parsed.reply_status))
        ? (parsed.reply_status as string)
        : parsed.needs_reply
          ? 'needs_reply'
          : 'no_reply_needed';
      const isUrgent = parsed.urgent === true && triageCategory === 'actionable';

      await db
        .update(emailThreads)
        .set({
          aiSummary: parsed.summary_ar,
          aiTopicTags: allTags,
          category: triageCategory,
          importance,
          replyStatus,
          isUrgent,
          urgentReason: isUrgent ? (parsed.urgent_reason ?? null) : null,
          aiClassifiedAt: sql`now()`,
          aiSummaryUpdatedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(emailThreads.id, thread.id));

      // Attach suggested actions to the most recent inbound message (the one
      // we'd be responding to). If no inbound, attach to the latest message.
      const targetMsg =
        [...msgs].reverse().find((m) => m.direction === 'inbound') ??
        msgs[msgs.length - 1];
      if (targetMsg && parsed.suggested_actions?.length) {
        await db
          .update(emailMessages)
          .set({
            aiSuggestedActions: parsed.suggested_actions,
            aiSummary: parsed.summary_ar.slice(0, 200),
          })
          .where(eq(emailMessages.id, targetMsg.id));
      }

      report.summarizedThreads++;

      // Run routing + linking right after the summary is written so the
      // thread immediately gets categorized (auto-close marketing, link to
      // client, create lead if business).
      try {
        const routed = await applyRoutingAndLinking(thread.id);
        if (routed.statusSet === 'closed') report.threadsAutoClosed++;
        if (routed.clientLinked) report.threadsLinkedToClient++;
        if (routed.leadCreated) report.leadsCreated++;
        // If routing just linked this thread to a real client, it's business —
        // undo any noise classification so it isn't hidden from the inbox.
        if (routed.clientLinked && NOISE_TRIAGE.has(triageCategory)) {
          await db
            .update(emailThreads)
            .set({ category: 'actionable', updatedAt: sql`now()` })
            .where(eq(emailThreads.id, thread.id));
        }
      } catch (err) {
        report.errors.push({
          threadId: thread.id,
          error: `routing: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      // Meeting notes extraction (Read.ai, Gemini Notes, Meet recordings,
      // Fathom, Otter, Granola). No-op for ordinary threads.
      try {
        const mn = await extractMeetingNotes(thread.id);
        if (mn.insertedId) report.meetingNotesExtracted++;
      } catch (err) {
        report.errors.push({
          threadId: thread.id,
          error: `meeting_notes: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      // Deep Email Intelligence — extract structured data from the latest
      // inbound message in this thread + generate ai_suggestions. The
      // extractor itself skips junk-category threads and outbound, so
      // burning tokens on noise is bounded.
      try {
        const [latestInbound] = await db
          .select({ id: emailMessages.id })
          .from(emailMessages)
          .where(
            and(
              eq(emailMessages.threadId, thread.id),
              eq(emailMessages.direction, 'inbound'),
            ),
          )
          .orderBy(desc(emailMessages.sentAt))
          .limit(1);
        if (latestInbound) {
          const ext = await extractEmail(latestInbound.id);
          if (ext.ok && ext.extractionId) {
            report.deepExtractions++;
            const gen = await generateSuggestionsForExtraction(ext.extractionId);
            if (gen.ok) report.suggestionsGenerated += gen.generated;
          }
        }
      } catch (err) {
        report.errors.push({
          threadId: thread.id,
          error: `intel: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      // Cross-thread conversation summary — only for threads with 2+
      // messages and only when stale. Skips lightweight automatically.
      try {
        await summarizeConversation(thread.id);
      } catch (err) {
        report.errors.push({
          threadId: thread.id,
          error: `convo: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } catch (err) {
      report.errors.push({
        threadId: thread.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Haiku pricing: $0.80/Mtok input, $4/Mtok output
  report.estimatedCostUsd =
    (report.totalInputTokens * 0.8 + report.totalOutputTokens * 4) / 1_000_000;
  report.finishedAt = new Date().toISOString();
  return report;
}
