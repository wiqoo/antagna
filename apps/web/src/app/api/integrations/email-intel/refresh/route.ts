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
import { getAdminUser } from '@/lib/auth-admin';
import { ingestGmail, SYSTEM_MAILBOX } from '@/lib/gmail-ingest';
import { summarizeThreads } from '@/lib/gmail-summarize';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const admin = await getAdminUser();
  if (!admin) {
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
