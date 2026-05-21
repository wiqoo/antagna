/**
 * Meeting notes ingest — Pillar 13.
 *
 * Detects automated meeting-recap emails (Read.ai, Gemini Notes, Fathom,
 * Otter, Meet recordings) during Gmail processing and extracts structured
 * data into the `meeting_notes` table.
 *
 * Idempotent: each thread maps to at most one meeting_notes row, keyed by
 * source + source_id = gmail_thread_id.
 */
import { db, meetingNotes, emailMessages, emailThreads } from '@antagna/db';
import { eq, and, asc } from 'drizzle-orm';
import { getAnthropic, ANTHROPIC_MODELS } from '@antagna/ai';

const MEETING_NOTES_SENDERS: { match: RegExp; source: string }[] = [
  { match: /@e\.read\.ai$/i,                          source: 'read.ai' },
  { match: /@meetai\.com$/i,                          source: 'meet.ai' },
  { match: /meet-recordings-noreply@google\.com/i,    source: 'meet' },
  { match: /gemini-notes@google\.com/i,               source: 'gemini' },
  { match: /@fathom\.video$/i,                        source: 'fathom' },
  { match: /@otter\.ai$/i,                            source: 'otter' },
  { match: /noreply@granola\.ai/i,                    source: 'granola' },
];

const SYSTEM_PROMPT = `You extract structured meeting notes from a meeting recap email.
Output STRICT JSON only:
{
  "meeting_title": "<concise title in Arabic if the meeting was in Arabic, else original language>",
  "meeting_date_iso": "<YYYY-MM-DDTHH:mm:ssZ or null if not detectable>",
  "attendees_text": "<comma-separated names; null if unknown>",
  "note_content": "<cleaned plain-text summary in 4-8 short bullets, Arabic if the meeting was Arabic, prefixed with • >",
  "action_items": [
    { "owner": "<name or null>", "action": "<short imperative sentence>", "due_iso": "<YYYY-MM-DD or null>" }
  ]
}

Be conservative — set null when not stated. Don't invent attendees.`;

export interface ExtractResult {
  threadId: string;
  skipped?: 'not_meeting_notes' | 'already_exists' | 'no_inbound';
  insertedId?: string;
  error?: string;
}

export async function extractMeetingNotes(
  threadId: string,
): Promise<ExtractResult> {
  // Resolve the thread and find the first inbound message — that's the one
  // sent BY the meeting-notes provider.
  const [thread] = await db
    .select({ id: emailThreads.id, gmailThreadId: emailThreads.gmailThreadId, subject: emailThreads.subject })
    .from(emailThreads)
    .where(eq(emailThreads.id, threadId))
    .limit(1);
  if (!thread) return { threadId, error: 'thread_not_found' };

  const [msg] = await db
    .select({
      id: emailMessages.id,
      fromEmail: emailMessages.fromEmail,
      fromName: emailMessages.fromName,
      subject: emailMessages.subject,
      bodyText: emailMessages.bodyText,
      bodyHtml: emailMessages.bodyHtml,
      sentAt: emailMessages.sentAt,
    })
    .from(emailMessages)
    .where(
      and(eq(emailMessages.threadId, threadId), eq(emailMessages.direction, 'inbound')),
    )
    .orderBy(asc(emailMessages.sentAt))
    .limit(1);
  if (!msg) return { threadId, skipped: 'no_inbound' };

  const match = MEETING_NOTES_SENDERS.find((p) => p.match.test(msg.fromEmail));
  if (!match) return { threadId, skipped: 'not_meeting_notes' };

  // Idempotency — already extracted this thread?
  const existing = await db
    .select({ id: meetingNotes.id })
    .from(meetingNotes)
    .where(eq(meetingNotes.sourceId, thread.gmailThreadId))
    .limit(1);
  if (existing[0]) return { threadId, skipped: 'already_exists' };

  // Build the prompt input — strip HTML if no text, cap at 8k chars.
  const body = (msg.bodyText ?? stripHtml(msg.bodyHtml ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
  const userPrompt = `Subject: ${msg.subject ?? '(no subject)'}\nFrom: ${msg.fromName ?? ''} <${msg.fromEmail}>\nSent: ${new Date(msg.sentAt).toISOString()}\n\n${body}`;

  try {
    const anthropic = getAnthropic();
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.haiku,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const block = resp.content.find((b) => b.type === 'text');
    const raw = block && block.type === 'text' ? block.text : '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { threadId, error: 'no_json_in_response' };

    const parsed = JSON.parse(jsonMatch[0]) as {
      meeting_title?: string;
      meeting_date_iso?: string | null;
      attendees_text?: string | null;
      note_content?: string;
      action_items?: { owner: string | null; action: string; due_iso: string | null }[];
    };

    const [inserted] = await db
      .insert(meetingNotes)
      .values({
        source: match.source,
        sourceId: thread.gmailThreadId,
        meetingTitle: parsed.meeting_title ?? thread.subject ?? null,
        meetingDate: parsed.meeting_date_iso
          ? new Date(parsed.meeting_date_iso)
          : msg.sentAt,
        attendeesText: parsed.attendees_text ?? null,
        noteContent: parsed.note_content ?? null,
        aiActionItems: parsed.action_items ?? [],
      })
      .returning({ id: meetingNotes.id });

    return { threadId, insertedId: inserted?.id };
  } catch (err) {
    return {
      threadId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Cheap HTML→text used only as a fallback for emails without a text part. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#?\w+;/g, ' ');
}
