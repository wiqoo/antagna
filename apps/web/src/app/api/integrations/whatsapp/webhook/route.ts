/**
 * Evolution API → Antagna webhook.
 *
 * Evolution POSTs every configured event here (see
 * infra/whatsapp/docker-compose.yml → WEBHOOK_EVENTS_*). We pick the events
 * we care about and normalize them into the `whatsapp_messages` table.
 *
 * Auth: Evolution doesn't sign webhooks by default, so we require the
 * `apikey` header to match `WHATSAPP_API_KEY`. (Evolution will include it
 * automatically when it has it set as the global key.) Failing that we
 * accept `Authorization: Bearer CRON_SECRET` so we can replay during tests.
 */
import { NextResponse } from 'next/server';
import { db, whatsappMessages } from '@antagna/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface EvolutionMessageKey {
  id?: string;
  remoteJid?: string;       // e.g. "966501234567@s.whatsapp.net"
  fromMe?: boolean;
  participant?: string;
}

interface EvolutionMessagePayload {
  key?: EvolutionMessageKey;
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string; mimetype?: string; url?: string };
    videoMessage?: { caption?: string; mimetype?: string; url?: string };
    audioMessage?: { mimetype?: string; url?: string };
    documentMessage?: { fileName?: string; mimetype?: string; url?: string };
  };
  messageTimestamp?: number;
}

interface EvolutionEvent {
  event?: string;
  instance?: string;
  data?: EvolutionMessagePayload | Record<string, unknown>;
}

export async function POST(req: Request) {
  // Auth check.
  const apiKey = req.headers.get('apikey');
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const expectedKey = process.env.WHATSAPP_API_KEY;
  const cronSecret = process.env.CRON_SECRET;

  const authed =
    (expectedKey && apiKey === expectedKey) ||
    (cronSecret && bearer === cronSecret);

  if (!authed) {
    return NextResponse.json(
      { ok: false, error: 'forbidden' },
      { status: 403 },
    );
  }

  let body: EvolutionEvent;
  try {
    body = (await req.json()) as EvolutionEvent;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400 },
    );
  }

  const event = body.event ?? '';

  // We only persist message events. Connection-state and QR events are
  // observable via the Evolution API directly when the admin UI asks.
  if (
    event !== 'messages.upsert' &&
    event !== 'send.message' &&
    event !== 'MESSAGES_UPSERT' &&
    event !== 'SEND_MESSAGE'
  ) {
    return NextResponse.json({ ok: true, skipped: event });
  }

  const data = (body.data ?? {}) as EvolutionMessagePayload;
  const key = data.key ?? {};
  if (!key.id || !key.remoteJid) {
    return NextResponse.json({ ok: true, skipped: 'no_key' });
  }

  // Skip if we've seen this message ID already (idempotent).
  const [existing] = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.baileysMessageId, key.id))
    .limit(1);
  if (existing) {
    return NextResponse.json({ ok: true, skipped: 'duplicate' });
  }

  // Phone numbers — strip the JID suffix (@s.whatsapp.net / @g.us / @lid).
  const stripJid = (s: string) => s.replace(/@.+$/, '');
  const fromMe = !!key.fromMe;
  const direction: 'inbound' | 'outbound' = fromMe ? 'outbound' : 'inbound';

  // Determine peer (the other party). When fromMe=true, remoteJid is the
  // recipient; when fromMe=false, remoteJid is the sender.
  const peer = '+' + stripJid(key.remoteJid);
  const us = process.env.WHATSAPP_OUR_E164 ?? 'unknown';
  const fromE164 = fromMe ? us : peer;
  const toE164 = fromMe ? peer : us;

  // Body + type.
  const msg = data.message ?? {};
  let bodyText: string | null = null;
  let messageType = 'text';
  let mediaUrl: string | null = null;
  if (msg.conversation) {
    bodyText = msg.conversation;
  } else if (msg.extendedTextMessage?.text) {
    bodyText = msg.extendedTextMessage.text;
  } else if (msg.imageMessage) {
    bodyText = msg.imageMessage.caption ?? null;
    messageType = 'image';
    mediaUrl = msg.imageMessage.url ?? null;
  } else if (msg.videoMessage) {
    bodyText = msg.videoMessage.caption ?? null;
    messageType = 'video';
    mediaUrl = msg.videoMessage.url ?? null;
  } else if (msg.audioMessage) {
    messageType = 'audio';
    mediaUrl = msg.audioMessage.url ?? null;
  } else if (msg.documentMessage) {
    bodyText = msg.documentMessage.fileName ?? null;
    messageType = 'document';
    mediaUrl = msg.documentMessage.url ?? null;
  }

  const receivedAt = data.messageTimestamp
    ? new Date(data.messageTimestamp * 1000)
    : new Date();

  await db.insert(whatsappMessages).values({
    baileysMessageId: key.id,
    direction,
    fromE164,
    toE164,
    messageType,
    bodyText,
    mediaUrl,
    rawPayload: body as unknown as Record<string, unknown>,
    threadKey: peer, // group by the other party until we wire proper threading
    receivedAt,
  });

  return NextResponse.json({ ok: true, persisted: true });
}
