/**
 * WPPConnect → Antagna webhook.
 *
 * WPPConnect Server POSTs JSON for every configured event. We pick the
 * message events (onmessage / onselfmessage) and normalize them into the
 * `whatsapp_messages` table.
 *
 * Auth: WPPConnect can't sign outbound webhooks. We require the URL to
 * carry `?key=<CRON_SECRET>` (or `?key=<WHATSAPP_API_KEY>`). The same
 * URL lives in the WPPConnect config — anyone scraping antagna-v2's
 * routes can guess the path but not the secret.
 */
import { NextResponse } from 'next/server';
import { db, whatsappMessages } from '@antagna/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface WppEvent {
  event?: string;             // 'onmessage' | 'onselfmessage' | 'onstatemessage' | 'onqrcode' | ...
  session?: string;
  // The actual message payload — present on onmessage / onselfmessage.
  id?: string | { _serialized?: string };
  body?: string;
  type?: string;              // 'chat' | 'image' | 'video' | 'audio' | 'ptt' | 'document' | 'location' | 'vcard'
  from?: string;              // '<jid>@c.us' or '<jid>@g.us'
  to?: string;
  t?: number;                 // unix timestamp (seconds)
  fromMe?: boolean;
  isGroupMsg?: boolean;
  notifyName?: string;
  pushname?: string;
  caption?: string;
  filename?: string;
  mimetype?: string;
  mediaUrl?: string;
  [k: string]: unknown;
}

const MESSAGE_EVENTS = new Set([
  'onmessage',
  'onselfmessage',
  'message',
  'self-message',
]);

function stripJid(jid: string): string {
  // e.g. '966590989518@c.us' → '+966590989518'
  const digits = jid.replace(/@.+$/, '').replace(/[^0-9]/g, '');
  return digits ? `+${digits}` : jid;
}

function messageIdOf(id: unknown): string | null {
  if (typeof id === 'string') return id;
  if (id && typeof id === 'object') {
    const v = (id as { _serialized?: string })._serialized;
    if (v) return v;
  }
  return null;
}

export async function POST(req: Request) {
  // URL-key auth (WPPConnect doesn't sign webhooks).
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.WHATSAPP_API_KEY;

  const authed =
    (cronSecret && key === cronSecret) || (apiKey && key === apiKey);

  if (!authed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: WppEvent;
  try {
    body = (await req.json()) as WppEvent;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const event = body.event ?? '';
  if (!MESSAGE_EVENTS.has(event)) {
    // QR / state / presence events — we don't persist them.
    return NextResponse.json({ ok: true, skipped: event });
  }

  const msgId = messageIdOf(body.id);
  if (!msgId) {
    return NextResponse.json({ ok: true, skipped: 'no_id' });
  }

  // Idempotent on the WPPConnect message id (stored in baileys_message_id
  // since the column was originally named for the Evolution/Baileys
  // implementation — same semantic).
  const [existing] = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.baileysMessageId, msgId))
    .limit(1);
  if (existing) {
    return NextResponse.json({ ok: true, skipped: 'duplicate' });
  }

  const fromMe = !!body.fromMe;
  const direction: 'inbound' | 'outbound' = fromMe ? 'outbound' : 'inbound';

  const peerJid = (fromMe ? body.to : body.from) ?? '';
  const ourJid = (fromMe ? body.from : body.to) ?? '';
  const peer = peerJid ? stripJid(peerJid) : 'unknown';
  const us = ourJid ? stripJid(ourJid) : process.env.WHATSAPP_OUR_E164 ?? 'unknown';
  const fromE164 = fromMe ? us : peer;
  const toE164 = fromMe ? peer : us;

  // Map WPPConnect's `type` enum to our messageType column.
  const wppType = (body.type ?? 'chat').toLowerCase();
  let messageType = 'text';
  if (wppType === 'image') messageType = 'image';
  else if (wppType === 'video') messageType = 'video';
  else if (wppType === 'audio' || wppType === 'ptt') messageType = 'audio';
  else if (wppType === 'document') messageType = 'document';
  else if (wppType === 'location') messageType = 'location';

  const bodyText = body.body ?? body.caption ?? null;
  const mediaUrl =
    typeof body.mediaUrl === 'string' ? body.mediaUrl : null;

  const receivedAt = body.t ? new Date(body.t * 1000) : new Date();

  await db.insert(whatsappMessages).values({
    baileysMessageId: msgId,
    direction,
    fromE164,
    toE164,
    messageType,
    bodyText,
    mediaUrl,
    rawPayload: body as unknown as Record<string, unknown>,
    threadKey: peer,
    receivedAt,
  });

  return NextResponse.json({ ok: true, persisted: true });
}
