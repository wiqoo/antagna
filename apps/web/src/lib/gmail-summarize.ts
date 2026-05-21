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
import { eq, isNull, or, sql, desc } from 'drizzle-orm';
import { getAnthropic, ANTHROPIC_MODELS } from '@antagna/ai';
import { applyRoutingAndLinking } from './gmail-routing';
import { extractMeetingNotes } from './meeting-notes';

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
  errors: { threadId: string; error: string }[];
}

export interface SummarizeOptions {
  /** Cap on threads to summarize per run (cost guard). */
  maxThreads?: number;
}

const SYSTEM_PROMPT = `You are Antagna's email thread classifier for Volt Production, a Saudi creative agency.

Given a thread (subject + messages), output STRICT JSON only — no prose:
{
  "summary_ar": "<2-3 sentences in Arabic, plain text. Lead with who + what + decision needed>",
  "category": "business" | "marketing" | "spam" | "internal" | "notification" | "automated",
  "urgency": "low" | "medium" | "high",
  "needs_reply": true | false,
  "topic_tags": ["..."],
  "suggested_actions": [
    { "type": "reply" | "create_lead" | "link_to_project" | "archive" | "follow_up" | "ignore",
      "reason": "<short Arabic>" }
  ]
}

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
  topic_tags: string[];
  suggested_actions: { type: string; reason: string }[];
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
    errors: [],
  };

  // Threads needing summary: no summary yet, or summary older than latest message.
  const eligible = await db
    .select({
      id: emailThreads.id,
      subject: emailThreads.subject,
      lastMessageAt: emailThreads.lastMessageAt,
    })
    .from(emailThreads)
    .where(
      or(
        isNull(emailThreads.aiSummary),
        sql`${emailThreads.aiSummaryUpdatedAt} IS NULL OR ${emailThreads.lastMessageAt} > ${emailThreads.aiSummaryUpdatedAt}`,
      ),
    )
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(maxThreads);

  report.eligibleThreads = eligible.length;

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

      const resp = await anthropic.messages.create({
        model: ANTHROPIC_MODELS.haiku,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: transcript }],
      });

      report.totalInputTokens += resp.usage.input_tokens;
      report.totalOutputTokens += resp.usage.output_tokens;

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

      await db
        .update(emailThreads)
        .set({
          aiSummary: parsed.summary_ar,
          aiTopicTags: allTags,
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
