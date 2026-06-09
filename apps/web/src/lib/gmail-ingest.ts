/**
 * Gmail ingestion: pull threads + messages from a connected mailbox and
 * normalize them into `email_threads` / `email_messages`.
 *
 * Idempotent on `gmail_thread_id` (threads) and `gmail_message_id`
 * (messages) — re-running is safe and cheap. The DB trigger
 * `tg_update_thread_counters` keeps message_count / last_message_at /
 * last_inbound_at / last_outbound_at in sync, so we don't touch those.
 */
import { db, emailThreads, emailMessages } from '@antagna/db';
import { eq, desc, sql } from 'drizzle-orm';
import type { gmail_v1 } from 'googleapis';
import { getGmailClient } from './google';
import { detectLang } from './detect-lang';

export const SYSTEM_MAILBOX = 'info@voltsaudi.com';

export interface IngestionReport {
  mailbox: string;
  startedAt: string;
  finishedAt: string;
  query: string;
  threadsFetched: number;
  threadsProcessed: number;
  messagesInserted: number;
  messagesSkipped: number;
  errors: { gmailThreadId?: string; gmailMessageId?: string; error: string }[];
}

export interface IngestOptions {
  /** Cap the time window on the very first run (no messages in DB yet). */
  sinceDays?: number;
  /** Hard cap on threads pulled per run. */
  maxThreads?: number;
  /** Override the query (e.g. for backfills). */
  query?: string;
}

export async function ingestGmail(
  mailbox: string = SYSTEM_MAILBOX,
  options: IngestOptions = {},
): Promise<IngestionReport> {
  const startedAt = new Date().toISOString();
  const sinceDays = options.sinceDays ?? 30;
  const maxThreads = options.maxThreads ?? 200;

  const report: IngestionReport = {
    mailbox,
    startedAt,
    finishedAt: '',
    query: '',
    threadsFetched: 0,
    threadsProcessed: 0,
    messagesInserted: 0,
    messagesSkipped: 0,
    errors: [],
  };

  const gmail = await getGmailClient(mailbox);

  // Determine the Gmail query. If we already have messages, only fetch newer
  // ones; otherwise fall back to a bounded time window.
  let q: string;
  if (options.query) {
    q = options.query;
  } else {
    const [latest] = await db
      .select({ sentAt: emailMessages.sentAt })
      .from(emailMessages)
      .orderBy(desc(emailMessages.sentAt))
      .limit(1);

    if (latest?.sentAt) {
      const afterSec = Math.floor(new Date(latest.sentAt).getTime() / 1000);
      q = `after:${afterSec}`;
    } else {
      q = `newer_than:${sinceDays}d`;
    }
  }
  report.query = q;

  // 1) Page through thread IDs.
  const threadIds: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.threads.list({
      userId: 'me',
      q,
      maxResults: 100,
      pageToken,
    });
    for (const t of res.data.threads ?? []) {
      if (t.id) threadIds.push(t.id);
      if (threadIds.length >= maxThreads) break;
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && threadIds.length < maxThreads);

  report.threadsFetched = threadIds.length;

  // 2) For each thread, fetch full + upsert.
  for (const gmailThreadId of threadIds) {
    try {
      const threadRes = await gmail.users.threads.get({
        userId: 'me',
        id: gmailThreadId,
        format: 'full',
      });
      const thread = threadRes.data;
      if (!thread.messages?.length) continue;

      const firstMsg = thread.messages[0];
      const subject = firstMsg
        ? (getHeader(firstMsg, 'Subject')?.slice(0, 998) ?? null)
        : null;

      const [upserted] = await db
        .insert(emailThreads)
        .values({ gmailThreadId, subject })
        .onConflictDoUpdate({
          target: emailThreads.gmailThreadId,
          set: { updatedAt: sql`now()` },
        })
        .returning({ id: emailThreads.id });

      if (!upserted) continue;

      for (const msg of thread.messages) {
        if (!msg.id) continue;

        // Skip if we already have this message id — idempotent.
        const existing = await db
          .select({ id: emailMessages.id })
          .from(emailMessages)
          .where(eq(emailMessages.gmailMessageId, msg.id))
          .limit(1);
        if (existing[0]) {
          report.messagesSkipped++;
          continue;
        }

        try {
          await insertMessage(upserted.id, msg, mailbox);
          report.messagesInserted++;
        } catch (err) {
          report.errors.push({
            gmailThreadId,
            gmailMessageId: msg.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      report.threadsProcessed++;
    } catch (err) {
      report.errors.push({
        gmailThreadId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

async function insertMessage(
  threadDbId: string,
  msg: gmail_v1.Schema$Message,
  mailbox: string,
): Promise<void> {
  const headers = msg.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    null;

  const fromHeader = get('From') ?? '';
  const toHeader = get('To') ?? '';
  const ccHeader = get('Cc');
  const messageIdHeader = get('Message-ID') ?? get('Message-Id');
  const inReplyToHeader = get('In-Reply-To');
  const msgSubject = get('Subject');

  const { name: fromName, email: fromEmail } = parseAddress(fromHeader);
  const toEmails = parseAddressList(toHeader).map((a) => a.email);
  const ccEmails = ccHeader
    ? parseAddressList(ccHeader).map((a) => a.email)
    : null;

  const direction: 'inbound' | 'outbound' =
    fromEmail.toLowerCase() === mailbox.toLowerCase() ? 'outbound' : 'inbound';

  const { text, html } = extractBody(msg.payload);
  const attachmentCount = countAttachments(msg.payload);

  const sentAt = msg.internalDate
    ? new Date(parseInt(msg.internalDate, 10))
    : new Date();

  await db.insert(emailMessages).values({
    threadId: threadDbId,
    gmailMessageId: msg.id!,
    internetMessageId: messageIdHeader,
    inReplyTo: inReplyToHeader,
    direction,
    fromEmail: fromEmail || 'unknown@unknown',
    fromName,
    toEmails: toEmails.length ? toEmails : [],
    ccEmails: ccEmails && ccEmails.length ? ccEmails : null,
    subject: msgSubject,
    bodyHtml: html,
    bodyText: text,
    snippet: msg.snippet ?? null,
    detectedLanguage: detectLang(text || msg.snippet || msgSubject),
    attachmentCount,
    sentAt,
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getHeader(
  msg: gmail_v1.Schema$Message,
  name: string,
): string | undefined {
  return (
    msg.payload?.headers?.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase(),
    )?.value ?? undefined
  );
}

function parseAddress(s: string): { name: string | null; email: string } {
  // "Name" <a@b.com>   OR   Name <a@b.com>   OR   a@b.com
  const m = s.match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/);
  if (m) {
    const name = m[1]?.trim();
    const email = m[2]?.trim() ?? '';
    return { name: name && name.length ? name : null, email };
  }
  return { name: null, email: s.trim() };
}

function parseAddressList(
  s: string,
): { name: string | null; email: string }[] {
  if (!s) return [];
  // Simple comma split. Edge case: quoted commas inside display names will
  // split incorrectly — rare enough to punt on.
  return s
    .split(',')
    .map((p) => parseAddress(p.trim()))
    .filter((a) => a.email);
}

function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined,
): { text: string | null; html: string | null } {
  if (!payload) return { text: null, html: null };
  let text: string | null = null;
  let html: string | null = null;

  const walk = (part: gmail_v1.Schema$MessagePart) => {
    if (part.mimeType === 'text/plain' && part.body?.data && !text) {
      text = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data && !html) {
      html = decodeBase64Url(part.body.data);
    }
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);
  return { text, html };
}

function countAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined,
): number {
  if (!payload) return 0;
  let count = 0;
  const walk = (part: gmail_v1.Schema$MessagePart) => {
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      count++;
    }
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);
  return count;
}

function decodeBase64Url(s: string): string {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}
