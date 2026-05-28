import { NextResponse } from 'next/server';
import { notify, type NotifyOpts } from '@/lib/notify';

/**
 * Internal notify endpoint — cron-secret gated. The worker (alerts, deadlines,
 * digest, monitoring brain) POSTs here so it never needs to import the web's
 * Resend / WPPConnect / Drizzle wiring directly. The web is the single fan-out
 * point; channel prefs + recipient language live here.
 *
 * Body: a single `NotifyOpts` OR `{ items: NotifyOpts[] }` for batches.
 * Auth: `x-cron-secret` header must match `CRON_SECRET` env.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_EVENTS = new Set([
  'daily_digest',
  'on_assignment',
  'on_comment',
  'on_deadline',
  'on_mention',
  'on_alert',
]);

function valid(item: unknown): item is NotifyOpts {
  if (!item || typeof item !== 'object') return false;
  const o = item as Record<string, unknown>;
  if (typeof o.recipientId !== 'string' || o.recipientId.length === 0) return false;
  if (typeof o.event !== 'string' || !ALLOWED_EVENTS.has(o.event)) return false;
  const c = o.content as Record<string, unknown> | undefined;
  if (!c || typeof c !== 'object') return false;
  const ar = c.ar as { title?: unknown } | undefined;
  const en = c.en as { title?: unknown } | undefined;
  if (!ar || typeof ar.title !== 'string' || ar.title.length === 0) return false;
  if (!en || typeof en.title !== 'string' || en.title.length === 0) return false;
  return true;
}

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'cron_secret_unset' },
      { status: 500 },
    );
  }
  if ((req.headers.get('x-cron-secret') ?? '') !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const items: unknown[] = Array.isArray((body as { items?: unknown[] }).items)
    ? ((body as { items: unknown[] }).items)
    : [body];

  const results: Array<{ recipientId: string; event: string; delivered: string[] }> = [];
  const skipped: Array<{ index: number; reason: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!valid(item)) {
      skipped.push({ index: i, reason: 'shape' });
      continue;
    }
    try {
      const out = await notify(item);
      results.push({
        recipientId: item.recipientId,
        event: item.event,
        delivered: out.delivered,
      });
    } catch (e) {
      console.error('[internal/notify]', e);
      skipped.push({ index: i, reason: 'send_error' });
    }
  }

  return NextResponse.json({ ok: true, sent: results.length, results, skipped });
}
