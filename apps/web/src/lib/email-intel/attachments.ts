/**
 * Email attachment parsing.
 *
 * For each Gmail message we already know the attachment_count. This
 * module fetches the bytes via Gmail API, runs the right parser per
 * mime type, stores the extracted text on email_attachments. We
 * DON'T persist the raw bytes — only the parsed content.
 *
 * Today: PDFs (pdf-parse). Images: deferred — wire to OpenAI vision
 * or Claude vision later.
 */
import { db, emailAttachments, emailMessages } from '@antagna/db';
import { eq, and } from 'drizzle-orm';
import { getGmailClient } from './../google';
import { SYSTEM_MAILBOX } from './../gmail-ingest';
// pdf-parse v2's typings expose named exports rather than a default.
// Use a runtime resolve that works for both ESM and CJS callsites.
import * as pdfParseMod from 'pdf-parse';
const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
  (pdfParseMod as { default?: (b: Buffer) => Promise<{ text: string }> }).default ??
  (pdfParseMod as unknown as (b: Buffer) => Promise<{ text: string }>);

const MAX_BYTES = 5 * 1024 * 1024; // 5MB cap
const MAX_TEXT_CHARS = 50_000;

export interface AttachmentRunResult {
  messageId: string;
  scanned: number;
  inserted: number;
  parsed: number;
  errors: number;
}

interface GmailPart {
  partId?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  body?: {
    attachmentId?: string | null;
    size?: number | null;
  } | null;
  parts?: GmailPart[] | null;
}

/**
 * Walk the parts tree and collect anything that looks like a real
 * attachment (has filename + attachmentId).
 */
function collectAttachments(part: GmailPart | undefined): Array<{
  partId: string;
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
}> {
  if (!part) return [];
  const out: ReturnType<typeof collectAttachments> = [];
  const queue: GmailPart[] = [part];
  while (queue.length > 0) {
    const p = queue.shift()!;
    if (
      p.filename &&
      p.filename.length > 0 &&
      p.body?.attachmentId &&
      p.mimeType
    ) {
      out.push({
        partId: p.partId ?? '',
        filename: p.filename,
        mimeType: p.mimeType,
        attachmentId: p.body.attachmentId,
        size: p.body.size ?? 0,
      });
    }
    for (const c of p.parts ?? []) queue.push(c);
  }
  return out;
}

export async function processMessageAttachments(
  messageDbId: string,
): Promise<AttachmentRunResult> {
  const result: AttachmentRunResult = {
    messageId: messageDbId,
    scanned: 0,
    inserted: 0,
    parsed: 0,
    errors: 0,
  };

  const [msg] = await db
    .select({
      id: emailMessages.id,
      gmailMessageId: emailMessages.gmailMessageId,
      attachmentCount: emailMessages.attachmentCount,
    })
    .from(emailMessages)
    .where(eq(emailMessages.id, messageDbId))
    .limit(1);
  if (!msg || !msg.gmailMessageId || msg.attachmentCount === 0) return result;

  const gmail = await getGmailClient(SYSTEM_MAILBOX);
  const full = await gmail.users.messages.get({
    userId: 'me',
    id: msg.gmailMessageId,
    format: 'full',
  });
  const atts = collectAttachments(full.data.payload as GmailPart);
  result.scanned = atts.length;
  if (atts.length === 0) return result;

  for (const a of atts) {
    // Skip oversized — pdf-parse can hang on huge files, and we don't
    // want to OOM the function.
    const tooBig = a.size > MAX_BYTES;

    // Idempotent insert on (message_id, gmail_attachment_id).
    let attachmentDbId: string | undefined;
    try {
      const [row] = await db
        .insert(emailAttachments)
        .values({
          messageId: msg.id,
          gmailAttachmentId: a.attachmentId,
          filename: a.filename,
          mimeType: a.mimeType,
          sizeBytes: a.size,
          extractionMethod: tooBig ? 'skipped' : null,
          extractionError: tooBig ? 'too_large' : null,
        })
        .onConflictDoNothing()
        .returning({ id: emailAttachments.id });
      attachmentDbId = row?.id;
      if (row) result.inserted++;
    } catch (err) {
      result.errors++;
      continue;
    }
    if (tooBig) continue;

    // Only PDFs supported for now. Skip other binary types silently.
    if (a.mimeType !== 'application/pdf') continue;

    try {
      const blob = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: msg.gmailMessageId,
        id: a.attachmentId,
      });
      const data = blob.data.data;
      if (!data) throw new Error('empty_attachment_body');

      // Gmail returns base64url-encoded bytes.
      const buf = Buffer.from(
        data.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      );
      const parsed = await pdfParse(buf);
      const text = (parsed.text ?? '').trim().slice(0, MAX_TEXT_CHARS);

      await db
        .update(emailAttachments)
        .set({
          extractedText: text || null,
          extractionMethod: 'pdf-parse',
          extractionError: null,
          extractedAt: new Date(),
        })
        .where(
          and(
            eq(emailAttachments.messageId, msg.id),
            eq(emailAttachments.gmailAttachmentId, a.attachmentId),
          ),
        );
      result.parsed++;
    } catch (err) {
      await db
        .update(emailAttachments)
        .set({
          extractionMethod: 'pdf-parse',
          extractionError: err instanceof Error ? err.message : String(err),
          extractedAt: new Date(),
        })
        .where(
          and(
            eq(emailAttachments.messageId, msg.id),
            eq(emailAttachments.gmailAttachmentId, a.attachmentId),
          ),
        );
      result.errors++;
    }
  }

  return result;
}

/**
 * Pull all parsed attachment text for a message — used by the deep
 * extractor to enrich its prompt with attachment content.
 */
export async function getAttachmentTextForMessage(
  messageDbId: string,
): Promise<string | null> {
  const rows = await db
    .select({
      filename: emailAttachments.filename,
      extractedText: emailAttachments.extractedText,
    })
    .from(emailAttachments)
    .where(eq(emailAttachments.messageId, messageDbId));
  const parts = rows
    .filter((r) => r.extractedText && r.extractedText.length > 0)
    .map((r) => `[Attachment: ${r.filename}]\n${r.extractedText}`);
  if (parts.length === 0) return null;
  // Cap total appended text so the email prompt doesn't blow up.
  return parts.join('\n\n').slice(0, 30_000);
}
