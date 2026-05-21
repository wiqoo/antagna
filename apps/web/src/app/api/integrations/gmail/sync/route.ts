import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ingestGmail, SYSTEM_MAILBOX } from '@/lib/gmail-ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Manual Gmail sync trigger. Pulls new threads/messages for the connected
 * system mailbox into email_threads + email_messages.
 *
 *   ?mailbox=info@voltsaudi.com   (defaults to SYSTEM_MAILBOX)
 *   ?sinceDays=30                 (only used on first-ever run)
 *   ?maxThreads=200               (hard cap per run)
 *   ?query=newer_than:7d          (override query for backfills)
 */
export async function POST(req: Request) {
  // Two auth paths: logged-in user (admin UI) or Bearer CRON_SECRET (Trigger.dev worker).
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const cronSecret = process.env.CRON_SECRET;
  const viaCron = !!(bearer && cronSecret && bearer === cronSecret);

  if (!viaCron) {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const mailbox = url.searchParams.get('mailbox') ?? SYSTEM_MAILBOX;
  const sinceDaysParam = url.searchParams.get('sinceDays');
  const maxThreadsParam = url.searchParams.get('maxThreads');
  const queryParam = url.searchParams.get('query');

  try {
    const report = await ingestGmail(mailbox, {
      sinceDays: sinceDaysParam ? parseInt(sinceDaysParam, 10) : undefined,
      maxThreads: maxThreadsParam ? parseInt(maxThreadsParam, 10) : undefined,
      query: queryParam ?? undefined,
    });
    return NextResponse.json({ ok: true, report });
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
