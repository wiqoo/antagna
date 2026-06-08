import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { sendText } from '@/lib/whatsapp';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

// Always-notified escalation recipients (Mohammed's request: Abu Luka + Khalid).
const ALWAYS = [
  { id: '593cd6cb-6a62-4500-bd2a-00d535a053c1', label: 'أبو لوكا' },
  { id: '116d52f9-0be5-4ae0-ab4b-a727185accf6', label: 'خالد الغامدي' },
];
const STALE_HOURS = 24; // reply overdue by a day+
const SENT_KEY = 'overdue_reply_sent_date';
const BASE = process.env.ANTAGNA_BASE_URL ?? 'https://antagna.me';

type Thread = {
  id: string;
  subject: string | null;
  ai_summary: string | null;
  hrs: number;
  client_id: string | null;
  client_name: string | null;
  am_id: string | null;
};
type Prof = { id: string; name: string | null; email: string | null; wa: string | null };

function authed(req: Request): boolean {
  const s = process.env.CRON_SECRET;
  return !!s && req.headers.get('authorization') === `Bearer ${s}`;
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  if (!authed(request)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const dry = url.searchParams.get('dry') === '1';
  // Test mode: send the full digest to ONE profile only (e.g. Mohammed), no dedup.
  const testProfile = url.searchParams.get('testProfile');

  // At-risk + overdue: high-importance threads we owe a reply on, gone quiet.
  const threads = (await db.execute<Thread>(sql`
    SELECT et.id::text AS id, et.subject, et.ai_summary,
      round(EXTRACT(epoch FROM now() - et.last_inbound_at) / 3600)::int AS hrs,
      et.client_id::text AS client_id,
      COALESCE(c.name_ar, c.name_en) AS client_name,
      COALESCE(
        (SELECT p.account_manager_id::text FROM projects p WHERE p.id = et.project_id),
        (SELECT ca.profile_id::text FROM client_assignments ca
           WHERE ca.client_id = et.client_id AND ca.role = 'primary_am' AND ca.active = true LIMIT 1)
      ) AS am_id
    FROM email_threads et
    LEFT JOIN clients c ON c.id = et.client_id
    WHERE et.reply_status = 'needs_reply'
      AND et.importance = 'high'
      AND et.status NOT IN ('spam', 'closed')
      AND et.last_inbound_at IS NOT NULL
      AND et.last_inbound_at < now() - (${STALE_HOURS} || ' hours')::interval
    ORDER BY et.last_inbound_at ASC
    LIMIT 100
  `)) as unknown as Thread[];

  if (threads.length === 0) {
    return NextResponse.json({ ok: true, dry, atRisk: 0, notified: 0 });
  }

  // Daily dedup — one escalation per calendar day (the cron runs once at 08:00).
  if (!dry && !testProfile) {
    const sentRows = (await db.execute(sql`SELECT value FROM system_settings WHERE key = ${SENT_KEY} LIMIT 1`)) as unknown as Array<{ value: { date?: string } }>;
    if (sentRows[0]?.value?.date === todayStr()) {
      return NextResponse.json({ ok: true, dry, atRisk: threads.length, notified: 0, skipped: 'already_sent_today' });
    }
  }

  // Group: ALWAYS recipients get every thread; each thread's AM gets its own threads.
  const byRecipient = new Map<string, Thread[]>();
  if (testProfile) {
    byRecipient.set(testProfile, [...threads]); // test → only this profile
  } else {
    for (const rid of ALWAYS.map((a) => a.id)) byRecipient.set(rid, [...threads]);
    for (const t of threads) {
      if (t.am_id && !byRecipient.has(t.am_id)) byRecipient.set(t.am_id, []);
      if (t.am_id) {
        const list = byRecipient.get(t.am_id)!;
        // ALWAYS recipients already have all threads; avoid dup-listing for them.
        if (!ALWAYS.some((a) => a.id === t.am_id)) list.push(t);
      }
    }
  }

  // Resolve recipient profiles.
  const ids = Array.from(byRecipient.keys());
  const profs = (await db.execute(sql`
    SELECT id::text AS id, display_name AS name, email, whatsapp_e164 AS wa
    FROM profiles WHERE id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})
  `)) as unknown as Prof[];
  const profById = new Map(profs.map((p) => [p.id, p]));

  const report: Array<Record<string, unknown>> = [];
  for (const [rid, list] of byRecipient) {
    if (list.length === 0) continue;
    const p = profById.get(rid);
    if (!p) continue;

    const head = `🔴 ${list.length} إيميل عاجل متأخّر الرد — محتاج متابعتك`;
    const linesWa = list.slice(0, 12).map((t) => `• ${(t.subject ?? '(بدون عنوان)').slice(0, 60)} — ${t.client_name ?? '—'} (متأخّر ${t.hrs}س)\n  ${BASE}/inbox/${t.id}`);
    const waBody = `${head}\n\n${linesWa.join('\n')}`;
    const emailHtml = `<div dir="rtl" style="font-family:system-ui,Arial;line-height:1.7">
      <h3 style="margin:0 0 8px">${head}</h3>
      <ul style="padding-inline-start:18px;margin:0">${list
        .map((t) => `<li style="margin-bottom:8px"><a href="${BASE}/inbox/${t.id}"><b>${escapeHtml(t.subject ?? '(بدون عنوان)')}</b></a> — ${escapeHtml(t.client_name ?? '—')} <span style="color:#b45">(متأخّر ${t.hrs} ساعة)</span>${t.ai_summary ? `<br><span style="color:#666;font-size:13px">${escapeHtml(t.ai_summary.slice(0, 180))}</span>` : ''}</li>`)
        .join('')}</ul></div>`;

    const channels: string[] = [];
    if (!dry) {
      // 1) In-app — one row per thread so each is clickable from the bell.
      for (const t of list.slice(0, 20)) {
        try {
          await db.execute(sql`
            INSERT INTO notifications (recipient_id, entity_type, entity_id, title, body, link_url, channels_requested, metadata)
            VALUES (${rid}::uuid, 'email_thread', ${t.id}::uuid,
              ${`إيميل عاجل متأخّر الرد: ${(t.subject ?? '').slice(0, 80)}`},
              ${`${t.client_name ?? ''} — متأخّر ${t.hrs} ساعة`},
              ${`/inbox/${t.id}`}, ${['in_app', 'email', 'whatsapp']}::text[],
              ${JSON.stringify({ event: 'on_alert', kind: 'overdue_reply', hrs: t.hrs })}::jsonb)`);
        } catch (e) {
          console.error('[overdue-reply in_app]', e);
        }
      }
      channels.push('in_app');
      // 2) Email + 3) WhatsApp (forced — critical escalation).
      if (p.email) {
        await sendEmail({ from: 'notifications@antagna.me', to: [p.email], subject: head, html: emailHtml }).catch(() => null);
        channels.push('email');
      }
      if (p.wa?.startsWith('+')) {
        await sendText(p.wa, waBody).catch(() => null);
        channels.push('whatsapp');
      }
    }
    report.push({ recipient: p.name, threads: list.length, channels: dry ? ['(dry)'] : channels });
  }

  if (!dry && !testProfile) {
    await db.execute(sql`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (${SENT_KEY}, ${JSON.stringify({ date: todayStr() })}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`);
  }

  return NextResponse.json({ ok: true, dry, atRisk: threads.length, notified: dry ? 0 : report.length, items: report });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}
