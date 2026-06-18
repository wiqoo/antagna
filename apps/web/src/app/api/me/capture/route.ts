import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

// External capture endpoint — Telegram/WhatsApp/Shortcuts POST here to drop an
// item into the personal inbox. Secret-protected (CRON_SECRET). Captures to the
// system owner (system_admin = Mohammed). Single-user by design.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const token = new URL(req.url).searchParams.get('token');
  return bearer === secret || token === secret;
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  let body: { content?: string; source?: string };
  try { body = await req.json(); } catch { body = {}; }
  const content = String(body.content ?? '').trim().slice(0, 2000);
  if (!content) return NextResponse.json({ ok: false, error: 'empty' }, { status: 400 });
  const source = ['telegram', 'whatsapp', 'text', 'voice', 'share'].includes(String(body.source)) ? String(body.source) : 'whatsapp';

  const rows = (await db.execute(sql`SELECT id::text FROM profiles WHERE role = 'system_admin' ORDER BY created_at LIMIT 1`)) as unknown as Array<{ id: string }>;
  const owner = rows[0]?.id;
  if (!owner) return NextResponse.json({ ok: false, error: 'no_owner' }, { status: 500 });

  await db.execute(sql`INSERT INTO me_inbox (owner_id, content, source) VALUES (${owner}::uuid, ${content}, ${source})`);
  return NextResponse.json({ ok: true });
}
