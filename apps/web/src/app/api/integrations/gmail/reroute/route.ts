import { NextResponse } from 'next/server';
import { db, emailThreads } from '@antagna/db';
import { isNotNull, sql } from 'drizzle-orm';
import { getAdminUser } from '@/lib/auth-admin';
import { applyRoutingAndLinking } from '@/lib/gmail-routing';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Apply routing + linking to all already-summarized threads. One-shot
 * backfill so the auto-close / lead-creation logic runs over data that
 * was summarized before the routing module existed.
 */
export async function POST(req: Request) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const cronSecret = process.env.CRON_SECRET;
  const viaCron = !!(bearer && cronSecret && bearer === cronSecret);

  if (!viaCron) {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
  }

  const threads = await db
    .select({ id: emailThreads.id })
    .from(emailThreads)
    .where(isNotNull(emailThreads.aiSummary));

  let autoClosed = 0;
  let clientLinked = 0;
  let leadsCreated = 0;
  let routeMatched = 0;
  const errors: { threadId: string; error: string }[] = [];

  for (const t of threads) {
    try {
      const r = await applyRoutingAndLinking(t.id);
      if (r.statusSet === 'closed') autoClosed++;
      if (r.clientLinked) clientLinked++;
      if (r.leadCreated) leadsCreated++;
      if (r.routeMatched) routeMatched++;
    } catch (err) {
      errors.push({
        threadId: t.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    report: {
      threadsScanned: threads.length,
      autoClosed,
      clientLinked,
      leadsCreated,
      routeMatched,
      errors,
    },
  });
}
