/**
 * POST /api/integrations/email-intel/refresh
 *
 * Runs the full pipeline NOW (admin-only) instead of waiting for the
 * 5-minute scheduled scanner: sync new emails → summarize + AI →
 * routing → meeting notes → deep extraction → suggestion generation.
 *
 * Same heavy lifting as the cron, just on demand. Capped per-call so a
 * UI click can't accidentally burn unbounded tokens.
 */
import { NextResponse } from 'next/server';
import { canAny } from '@/lib/authz';
import { ingestGmail, SYSTEM_MAILBOX } from '@/lib/gmail-ingest';
import { summarizeThreads } from '@/lib/gmail-summarize';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  // Gate on the comms read perm (mirrors /inbox) instead of admin-only role.
  // Triggering an on-demand refresh of the inbox pipeline is available to
  // anyone who can read the inbox; per-call caps below bound token spend.
  const canRead = await canAny([
    'email_threads.read.all',
    'email_threads.read.assigned',
  ]);
  if (!canRead) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const sync = await ingestGmail(SYSTEM_MAILBOX, {
      sinceDays: 7,
      maxThreads: 30,
    });
    const summary = await summarizeThreads({ maxThreads: 20 });
    return NextResponse.json({ ok: true, sync, summary });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
