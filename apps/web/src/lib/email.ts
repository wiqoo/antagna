/**
 * Transactional email — Resend.
 *
 * Antagna sends via the `antagna.me` domain (Resend-verified since
 * 2026-05-02). Any `*@antagna.me` works as `from` without separate
 * verification.
 *
 * Send paths:
 *   - sendEmail()           one-shot send. Returns Resend message id.
 *   - sendApprovedDrafts()  picks up email_drafts where status='approved'
 *                            (and scheduled_for is null or in the past),
 *                            sends each, updates status/sent_at/sent_message_id.
 *                            Used by the email-send-scanner Trigger.dev task.
 */
import { db, emailDrafts } from '@antagna/db';
import { eq, sql, and, or, isNull, lte } from 'drizzle-orm';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const VERIFIED_DOMAIN = 'antagna.me';

export interface SendEmailInput {
  from: string;            // must end with @antagna.me
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not set' };

  if (!input.from.endsWith(`@${VERIFIED_DOMAIN}`)) {
    return {
      ok: false,
      error: `from must be a @${VERIFIED_DOMAIN} address (got: ${input.from})`,
    };
  }
  if (input.to.length === 0) return { ok: false, error: 'no recipients' };
  if (!input.html && !input.text) {
    return { ok: false, error: 'body html or text required' };
  }

  const payload: Record<string, unknown> = {
    from: input.from,
    to: input.to,
    subject: input.subject,
  };
  if (input.cc?.length) payload.cc = input.cc;
  if (input.bcc?.length) payload.bcc = input.bcc;
  if (input.replyTo) payload.reply_to = input.replyTo;
  if (input.html) payload.html = input.html;
  if (input.text) payload.text = input.text;
  if (input.tags?.length) payload.tags = input.tags;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      return { ok: false, error: json.message ?? json.name ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: json.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface DraftSendReport {
  scanned: number;
  sent: number;
  failed: number;
  errors: { draftId: string; error: string }[];
}

/**
 * Pick approved drafts that are ready to send (scheduled_for null or past)
 * and send each via Resend. Updates the draft row to sent or failed.
 */
export async function sendApprovedDrafts(
  limit = 20,
): Promise<DraftSendReport> {
  const drafts = await db
    .select()
    .from(emailDrafts)
    .where(
      and(
        eq(emailDrafts.status, 'approved'),
        or(
          isNull(emailDrafts.scheduledFor),
          lte(emailDrafts.scheduledFor, new Date()),
        ),
      ),
    )
    .limit(limit);

  const report: DraftSendReport = {
    scanned: drafts.length,
    sent: 0,
    failed: 0,
    errors: [],
  };

  for (const d of drafts) {
    const r = await sendEmail({
      from: d.sendFromAlias,
      to: d.toEmails,
      cc: d.ccEmails ?? undefined,
      bcc: d.bccEmails ?? undefined,
      subject: d.subject,
      html: d.bodyHtml,
      text: d.bodyText ?? undefined,
      tags: [{ name: 'draft_id', value: d.id }],
    });

    if (r.ok && r.messageId) {
      await db
        .update(emailDrafts)
        .set({
          status: 'sent',
          sentAt: new Date(),
          sentMessageId: r.messageId,
          sendError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailDrafts.id, d.id));
      report.sent++;
    } else {
      await db
        .update(emailDrafts)
        .set({
          status: 'failed',
          sendError: r.error ?? 'unknown',
          updatedAt: new Date(),
        })
        .where(eq(emailDrafts.id, d.id));
      report.failed++;
      report.errors.push({ draftId: d.id, error: r.error ?? 'unknown' });
    }
  }

  return report;
}
