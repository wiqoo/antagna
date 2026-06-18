import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { learnProfile } from '@/app/me/brain';
import { refreshInsights } from '@/app/me/insights-engine';
import { ensureAreas } from '@/app/me/areas';

// Daily learning loop: re-distill each active owner's profile and regenerate
// their insights. AI-gated + best-effort (no credits → graceful no-op).
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const owners = (await db.execute(sql`
    SELECT DISTINCT owner_id::text AS id FROM (
      SELECT owner_id FROM me_tasks WHERE created_at >= now() - interval '30 days'
      UNION SELECT owner_id FROM me_messages WHERE created_at >= now() - interval '30 days'
      UNION SELECT owner_id FROM me_transactions WHERE created_at >= now() - interval '30 days'
    ) x
    LIMIT 25
  `)) as unknown as Array<{ id: string }>;

  let learned = 0;
  for (const o of owners) {
    try {
      await ensureAreas(o.id);
      const ok = await learnProfile(o.id);
      await refreshInsights(o.id);
      if (ok) learned += 1;
    } catch (e) {
      console.error('[me-learn] owner failed', o.id, e);
    }
  }
  return NextResponse.json({ ok: true, owners: owners.length, learned });
}
