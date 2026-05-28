/**
 * C4 — WhatsApp media + voice transcription scanner.
 *
 * Two passes per run:
 *   1) Stash inbound media. Any whatsapp_messages row with `media_url` but no
 *      `media_storage_path` → fetch the URL (handles `data:` URIs and regular
 *      URLs) → put in the private `whatsapp-media` bucket → save the path.
 *   2) Transcribe voice notes. Any row where message_type ∈ (audio, voice) and
 *      transcription IS NULL but media_storage_path IS NOT NULL → pull the
 *      audio from the bucket → OpenAI Whisper → save transcription.
 *
 * Both are best-effort: failures are logged and the next run picks them up
 * (idempotent via the partial indexes on whatsapp_messages).
 *
 * Runs every 5 minutes — voice notes should land in the team's inbox before
 * the next sip of coffee.
 */
// Piggybacks on alert-scanner (every 5 min) — see index.ts. Trigger.dev Pro
// caps us at 10 scheduled tasks, so this is a plain async function callable
// from another scheduler rather than its own schedules.task().
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getOpenAI } from '@antagna/ai';

const BUCKET = 'whatsapp-media';
const PER_RUN_LIMIT = 20;

type MediaRow = {
  id: string;
  mediaUrl: string;
  messageType: string;
  receivedAt: string;
};

type VoiceRow = {
  id: string;
  storagePath: string;
  messageType: string;
};

function supabaseConfig(): { url: string; serviceKey: string } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('SUPABASE_URL is not set');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return { url: url.replace(/\/$/, ''), serviceKey };
}

function extFor(mt: string): string {
  if (mt === 'image') return 'jpg';
  if (mt === 'video') return 'mp4';
  if (mt === 'audio' || mt === 'voice') return 'ogg';
  if (mt === 'document') return 'pdf';
  return 'bin';
}

function contentTypeFor(mt: string): string {
  if (mt === 'image') return 'image/jpeg';
  if (mt === 'video') return 'video/mp4';
  if (mt === 'audio' || mt === 'voice') return 'audio/ogg';
  if (mt === 'document') return 'application/pdf';
  return 'application/octet-stream';
}

async function bytesFromUrl(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  if (url.startsWith('data:')) {
    // data:<mime>;base64,<...>
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('malformed data URI');
    const mime = match[1] ?? 'application/octet-stream';
    const b64 = match[2] ?? '';
    return { bytes: Buffer.from(b64, 'base64'), contentType: mime };
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${r.status}: ${url.slice(0, 80)}`);
  const ct = r.headers.get('content-type') ?? 'application/octet-stream';
  const buf = Buffer.from(await r.arrayBuffer());
  return { bytes: buf, contentType: ct };
}

async function uploadToBucket(
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const { url, serviceKey } = supabaseConfig();
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: new Uint8Array(bytes),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`storage upload ${r.status}: ${txt.slice(0, 200)}`);
  }
}

async function downloadFromBucket(path: string): Promise<Buffer> {
  const { url, serviceKey } = supabaseConfig();
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    headers: { Authorization: `Bearer ${serviceKey}` },
  });
  if (!r.ok) throw new Error(`storage download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function runWhatsappMediaScan(): Promise<{
  checked: number;
  stashed: number;
  transcribed: number;
}> {
    // ----- Pass 1: media → bucket -----
    const pending = (await db.execute(sql`
      SELECT id::text AS id, media_url AS "mediaUrl",
             message_type AS "messageType", received_at AS "receivedAt"
      FROM whatsapp_messages
      WHERE media_url IS NOT NULL AND media_storage_path IS NULL
      ORDER BY received_at DESC
      LIMIT ${PER_RUN_LIMIT}
    `)) as unknown as MediaRow[];

    let stashed = 0;
    for (const row of pending) {
      try {
        const { bytes, contentType } = await bytesFromUrl(row.mediaUrl);
        const datePart = row.receivedAt
          ? new Date(row.receivedAt).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        const path = `${datePart}/${row.id}.${extFor(row.messageType)}`;
        await uploadToBucket(path, bytes, contentType || contentTypeFor(row.messageType));
        await db.execute(sql`
          UPDATE whatsapp_messages
          SET media_storage_path = ${path}
          WHERE id = ${row.id}::uuid
        `);
        stashed++;
      } catch (e) {
        console.error(`[whatsapp-media-scanner] stash ${row.id}:`, e);
      }
    }

    // ----- Pass 2: voice → Whisper -----
    const voices = (await db.execute(sql`
      SELECT id::text AS id, media_storage_path AS "storagePath",
             message_type AS "messageType"
      FROM whatsapp_messages
      WHERE message_type IN ('audio','voice')
        AND transcription IS NULL
        AND media_storage_path IS NOT NULL
      ORDER BY received_at DESC
      LIMIT ${PER_RUN_LIMIT}
    `)) as unknown as VoiceRow[];

    let transcribed = 0;
    if (voices.length > 0) {
      const openai = getOpenAI();
      for (const v of voices) {
        try {
          const audio = await downloadFromBucket(v.storagePath);
          // Whisper expects a File/Blob; supply via Web File API.
          const file = new File([new Uint8Array(audio)], `${v.id}.ogg`, {
            type: 'audio/ogg',
          });
          const resp = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file,
            // Hint Arabic + English to improve mixed-language accuracy.
            language: 'ar',
          });
          const text = (resp.text ?? '').slice(0, 4000);
          if (text) {
            await db.execute(sql`
              UPDATE whatsapp_messages
              SET transcription = ${text}
              WHERE id = ${v.id}::uuid
            `);
            transcribed++;
          }
        } catch (e) {
          console.error(`[whatsapp-media-scanner] whisper ${v.id}:`, e);
        }
      }
    }

    return {
      checked: pending.length + voices.length,
      stashed,
      transcribed,
    };
}
