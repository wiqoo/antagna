import { db } from '@antagna/db';
import { sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { sendText } from '@/lib/whatsapp';
import { resolveNotifPrefs } from '@/app/settings/notif-prefs';

export interface NotifContent {
  ar: { title: string; body?: string };
  en: { title: string; body?: string };
}

export interface NotifyOpts {
  recipientId: string;
  /** One of the notif-prefs events: daily_digest|on_assignment|on_comment|on_deadline|on_mention|on_alert */
  event: string;
  content: NotifContent;
  linkUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

type ProfRow = {
  email: string | null;
  wa: string | null;
  lang: string;
  prefs: unknown;
};

/**
 * Unified notification service — the single fan-out point. Reads the recipient's
 * per-event channel prefs (A7) + ui_language (A0), then delivers via the enabled
 * channels in THEIR language: in-app row always-safe, email (Resend), WhatsApp
 * (sendText). Best-effort per channel; records requested vs delivered. Used by
 * alerts/assignments/the monitoring brain (A4).
 */
export async function notify(opts: NotifyOpts): Promise<{ delivered: string[] }> {
  const profRows = (await db.execute(sql`
    SELECT email, whatsapp_e164 AS wa, ui_language AS lang, notification_prefs AS prefs
    FROM profiles WHERE id = ${opts.recipientId}::uuid LIMIT 1
  `)) as unknown as ProfRow[];
  const p = profRows[0];
  if (!p) return { delivered: [] };

  const channels = resolveNotifPrefs(p.prefs)[opts.event] ?? {
    inApp: true,
    email: false,
    whatsapp: false,
  };
  const lang: 'ar' | 'en' = p.lang === 'en' ? 'en' : 'ar';
  const { title, body } = opts.content[lang];

  const requested: string[] = [];
  if (channels.inApp) requested.push('in_app');
  if (channels.email && p.email) requested.push('email');
  if (channels.whatsapp && p.wa) requested.push('whatsapp');
  const delivered: string[] = [];

  // 1) In-app (always safe — the bell).
  if (channels.inApp) {
    try {
      await db.execute(sql`
        INSERT INTO notifications
          (recipient_id, entity_type, entity_id, title, body, link_url,
           channels_requested, metadata)
        VALUES (
          ${opts.recipientId}::uuid, ${opts.entityType ?? null},
          ${opts.entityId ?? null}::uuid, ${title}, ${body ?? null},
          ${opts.linkUrl ?? null}, ${requested}::text[],
          ${JSON.stringify({ event: opts.event, ...(opts.metadata ?? {}) })}::jsonb
        )
      `);
      delivered.push('in_app');
    } catch (e) {
      console.error('[notify:in_app]', e);
    }
  }

  // 2) Email (Resend), in the recipient's language.
  if (channels.email && p.email) {
    try {
      const res = await sendEmail({
        from: 'notifications@antagna.me',
        to: [p.email],
        subject: title,
        text: body ? `${title}\n\n${body}` : title,
        html: `<div dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="font-family:system-ui,sans-serif"><h2 style="margin:0 0 8px">${title}</h2>${body ? `<p style="margin:0;color:#444">${body}</p>` : ''}${opts.linkUrl ? `<p style="margin:12px 0 0"><a href="${opts.linkUrl}">${lang === 'ar' ? 'افتح في Antagna' : 'Open in Antagna'}</a></p>` : ''}</div>`,
      });
      if (res.ok) delivered.push('email');
    } catch (e) {
      console.error('[notify:email]', e);
    }
  }

  // 3) WhatsApp, in the recipient's language.
  if (channels.whatsapp && p.wa?.startsWith('+')) {
    try {
      const text = body ? `${title}\n${body}` : title;
      const r = await sendText(p.wa, opts.linkUrl ? `${text}\n${opts.linkUrl}` : text);
      if (r.ok) delivered.push('whatsapp');
    } catch (e) {
      console.error('[notify:whatsapp]', e);
    }
  }

  if (delivered.length > 0) {
    await db
      .execute(
        sql`UPDATE notifications SET channels_delivered = ${delivered}::text[]
            WHERE recipient_id = ${opts.recipientId}::uuid
              AND created_at > now() - interval '10 seconds'
            AND title = ${title}`,
      )
      .catch(() => {});
  }

  return { delivered };
}
