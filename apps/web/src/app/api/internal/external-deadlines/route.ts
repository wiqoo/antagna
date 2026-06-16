import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { sendEmail } from '@/lib/email';

// Daily reminder: external jobs whose final delivery is due within 48h and not
// yet reminded → notify both Volt (job creator) and the partner once.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BASE = process.env.ANTAGNA_BASE_URL ?? 'https://antagna.me';
const FROM = 'notifications@antagna.me';

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}
function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
function body(title: string, dueLabel: string, ctaUrl: string): string {
  return `<div dir="rtl" style="font-family:system-ui,Arial;line-height:1.7;color:#1a1a1a">
    <h3 style="margin:0 0 8px">⏰ تذكير بموعد التسليم — ${esc(title)}</h3>
    <p style="margin:0">الموعد النهائي: <b>${esc(dueLabel)}</b>.</p>
    <p style="margin:14px 0 0"><a href="${ctaUrl}" style="background:#FF6B1A;color:#1a1a1a;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:600;display:inline-block">فتح المشروع</a></p>
    <p style="margin:16px 0 0;color:#888;font-size:12px">Volt Production · المشاريع الخارجية</p>
  </div>`;
}

interface Row {
  id: string; title: string; code: string; dueAt: string;
  partnerEmail: string | null; voltEmail: string | null;
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const due = (await db.execute(sql`
    SELECT j.id::text, j.title, j.code, j.final_due_at AS "dueAt",
      COALESCE(
        (SELECT u.email FROM ext_users e JOIN auth.users u ON u.id = e.auth_user_id
         WHERE e.partner_id = j.partner_id AND e.role = 'partner' ORDER BY e.created_at DESC LIMIT 1),
        p.contact_email
      ) AS "partnerEmail",
      (SELECT pr.email FROM profiles pr WHERE pr.id = j.created_by) AS "voltEmail"
    FROM external_jobs j LEFT JOIN partners p ON p.id = j.partner_id
    WHERE j.final_due_at IS NOT NULL
      AND j.final_due_at BETWEEN now() AND now() + interval '48 hours'
      AND j.status NOT IN ('delivered', 'cancelled')
      AND j.final_reminder_sent_at IS NULL
  `)) as unknown as Row[];

  let reminded = 0;
  for (const r of due) {
    const dueLabel = new Date(r.dueAt).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
    const subject = `تذكير موعد — ${r.title} (${r.code})`;
    if (r.partnerEmail) {
      await sendEmail({ from: FROM, to: [r.partnerEmail], subject, html: body(r.title, dueLabel, `${BASE}/outsource/portal/${r.id}`) }).catch(() => null);
    }
    if (r.voltEmail) {
      await sendEmail({ from: FROM, to: [r.voltEmail], subject, html: body(r.title, dueLabel, `${BASE}/outsource/${r.id}`) }).catch(() => null);
    }
    await db.execute(sql`UPDATE external_jobs SET final_reminder_sent_at = now() WHERE id = ${r.id}::uuid`);
    reminded += 1;
  }

  return NextResponse.json({ ok: true, reminded });
}
