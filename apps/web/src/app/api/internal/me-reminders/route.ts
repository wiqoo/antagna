import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { sendEmail } from '@/lib/email';

// Daily personal reminders: email each owner who has overdue tasks or aged
// waiting-on items (≥3 days). Reuses the Antagna login email; one digest each.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BASE = process.env.ANTAGNA_BASE_URL ?? 'https://antagna.me';
const FROM = 'notifications@antagna.me';

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}

interface Row { id: string; email: string | null; name: string | null; overdue: number; aged: number }

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const owners = (await db.execute(sql`
    WITH agg AS (
      SELECT x.owner_id,
        (SELECT count(*)::int FROM me_tasks t WHERE t.owner_id = x.owner_id AND t.status <> 'done' AND t.due_date < current_date) AS overdue,
        (SELECT count(*)::int FROM me_waiting w WHERE w.owner_id = x.owner_id AND w.resolved = false AND w.since <= current_date - 3) AS aged
      FROM (SELECT owner_id FROM me_tasks UNION SELECT owner_id FROM me_waiting) x
    )
    SELECT a.owner_id::text AS id, pr.email, pr.display_name AS name, a.overdue, a.aged
    FROM agg a JOIN profiles pr ON pr.id = a.owner_id
    WHERE (a.overdue > 0 OR a.aged > 0) AND pr.email IS NOT NULL
  `)) as unknown as Row[];

  let sent = 0;
  for (const o of owners) {
    if (!o.email) continue;
    const parts: string[] = [];
    if (o.overdue > 0) parts.push(`${o.overdue} مهمة متأخرة`);
    if (o.aged > 0) parts.push(`${o.aged} معلّق من أكتر من ٣ أيام`);
    await sendEmail({
      from: FROM,
      to: [o.email],
      subject: `تذكير مساحتك — ${parts.join(' · ')}`,
      html: `<div dir="rtl" style="font-family:system-ui,Arial;line-height:1.7;color:#1a1a1a">
        <h3 style="margin:0 0 8px">☀️ صباح الخير${o.name ? ' يا ' + String(o.name).split(' ')[0] : ''}</h3>
        <p style="margin:0">عندك <b>${parts.join('</b> و<b>')}</b>. افتح مساحتك وخلّص الأهم.</p>
        <p style="margin:14px 0 0"><a href="${BASE}/me" style="background:#FF6B1A;color:#1a1a1a;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:600;display:inline-block">افتح مساحتي</a></p>
        <p style="margin:16px 0 0;color:#888;font-size:12px">مساحتي · Volt</p>
      </div>`,
    }).catch(() => null);
    sent += 1;
  }
  return NextResponse.json({ ok: true, sent });
}
