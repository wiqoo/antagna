import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage, checkAiBudget } from '@antagna/ai';
import { sendText } from '@/lib/whatsapp';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const COOLDOWN_HOURS = 48; // allow both the Sat + Wed runs, block accidental doubles
const STALE_DAYS = 3;
const SENT_KEY = 'quotation_followup_sent';
const BASE = process.env.ANTAGNA_BASE_URL ?? 'https://antagna.me';

type Row = {
  id: string;
  code: string;
  title: string;
  quote_no: string;
  client_name: string | null;
  stage: string;
  last_email_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  am_id: string | null;
  am_name: string | null;
  am_email: string | null;
  am_wa: string | null;
  pm_id: string | null;
  pm_name: string | null;
  pm_email: string | null;
  pm_wa: string | null;
  cb_id: string | null;
  cb_name: string | null;
  cb_email: string | null;
  cb_wa: string | null;
};

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function relAr(iso: string | null): string {
  const d = daysAgo(iso);
  if (d === null) return 'لا يوجد';
  if (d <= 0) return 'اليوم';
  if (d === 1) return 'أمس';
  return `منذ ${d} يوم`;
}

export async function POST(request: Request) {
  if (!authed(request)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const dry = new URL(request.url).searchParams.get('dry') === '1';

  const rows = (await db.execute<Row>(sql`
    WITH email_act AS (
      SELECT t.project_id,
        max(m.sent_at) AS last_email_at,
        max(m.sent_at) FILTER (WHERE m.direction = 'inbound')  AS last_inbound_at,
        max(m.sent_at) FILTER (WHERE m.direction = 'outbound') AS last_outbound_at
      FROM email_threads t JOIN email_messages m ON m.thread_id = t.id
      WHERE t.project_id IS NOT NULL
      GROUP BY t.project_id
    )
    SELECT p.id::text AS id, p.code,
      COALESCE(p.title, p.title_ar) AS title,
      p.dafterah_quote_number AS quote_no, p.stage,
      COALESCE(c.name_ar, c.name_en) AS client_name,
      ea.last_email_at::text, ea.last_inbound_at::text, ea.last_outbound_at::text,
      am.id::text AS am_id, am.display_name AS am_name, am.email AS am_email, am.whatsapp_e164 AS am_wa,
      pm.id::text AS pm_id, pm.display_name AS pm_name, pm.email AS pm_email, pm.whatsapp_e164 AS pm_wa,
      cb.id::text AS cb_id, cb.display_name AS cb_name, cb.email AS cb_email, cb.whatsapp_e164 AS cb_wa
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN email_act ea ON ea.project_id = p.id
    LEFT JOIN profiles am ON am.id = p.account_manager_id
    LEFT JOIN profiles pm ON pm.id = p.project_manager_id
    LEFT JOIN profiles cb ON cb.id = p.created_by
    WHERE p.archived_at IS NULL
      AND p.dafterah_quote_number IS NOT NULL AND btrim(p.dafterah_quote_number) <> ''
      AND (p.dafterah_invoice_number IS NULL OR btrim(p.dafterah_invoice_number) = '')
      AND p.stage NOT IN ('delivered', 'archived', 'lost', 'cancelled')
      AND COALESCE(ea.last_email_at, p.quoted_at, p.updated_at) < now() - (${STALE_DAYS} || ' days')::interval
    ORDER BY COALESCE(ea.last_email_at, p.quoted_at, p.updated_at) ASC
    LIMIT 100
  `)) as unknown as Row[];

  // Cooldown map.
  const sentRows = (await db.execute(sql`
    SELECT value FROM system_settings WHERE key = ${SENT_KEY} LIMIT 1
  `)) as unknown as Array<{ value: Record<string, string> }>;
  const sentMap: Record<string, string> = sentRows[0]?.value ?? {};
  const fresh = rows.filter((r) => {
    const last = sentMap[r.id];
    return !last || Date.now() - new Date(last).getTime() > COOLDOWN_HOURS * 3600_000;
  });

  // Budget gate BEFORE the per-quote suggestion loop (each fires a Haiku call).
  if (!dry && fresh.length > 0) {
    const budget = await checkAiBudget({ userId: null });
    if (!budget.ok) {
      return NextResponse.json({ ok: false, skipped: 'over_budget', reason: budget.reason, scanned: rows.length });
    }
  }

  const report: Array<Record<string, unknown>> = [];
  for (const r of fresh) {
    const link = `${BASE}/projects/${r.id}`;
    const suggestion = await suggestFollowup(r);

    const lines = [
      `🔔 *متابعة عرض سعر* — ${r.title} (${r.code})`,
      `العميل: ${r.client_name ?? '—'} · رقم العرض: ${r.quote_no}`,
      `لسه ما اتحوّلش لفاتورة · آخر إيميل ${relAr(r.last_email_at)} (وارد ${relAr(r.last_inbound_at)} · صادر ${relAr(r.last_outbound_at)})`,
      ``,
      suggestion,
      ``,
      `الإجراء: تابِع العميل — أو لو مفيش تجاوب حوّل المشروع لـ «مُلغى» من صفحة المشروع:`,
      link,
    ];
    const waBody = lines.join('\n');
    const emailHtml = `<div dir="rtl" style="font-family:system-ui,Arial;line-height:1.7">
      <h3 style="margin:0 0 6px">🔔 متابعة عرض سعر — ${escapeHtml(r.title)} <span style="color:#888">(${r.code})</span></h3>
      <p style="margin:0 0 4px">العميل: <b>${escapeHtml(r.client_name ?? '—')}</b> · رقم العرض: <b>${escapeHtml(r.quote_no)}</b></p>
      <p style="margin:0 0 4px;color:#b45">لم يتحوّل إلى فاتورة بعد · آخر إيميل ${relAr(r.last_email_at)} (وارد ${relAr(r.last_inbound_at)} · صادر ${relAr(r.last_outbound_at)})</p>
      <p style="margin:10px 0;padding:10px;background:#f6f6f8;border-radius:8px">${escapeHtml(suggestion)}</p>
      <p>الإجراء: تابِع العميل، أو حوّل المشروع لـ «مُلغى» إن لم يكن هناك تجاوب — من <a href="${link}">صفحة المشروع</a>.</p>
    </div>`;

    // Recipients: PM + AM (dedupe by profile id). Fallback to the project's
    // creator so a stalled quote never silently reaches no one.
    let recipients = dedupeRecipients([
      { id: r.pm_id, name: r.pm_name, email: r.pm_email, wa: r.pm_wa, role: 'مدير المشروع' },
      { id: r.am_id, name: r.am_name, email: r.am_email, wa: r.am_wa, role: 'مدير الحساب' },
    ]);
    if (recipients.length === 0) {
      recipients = dedupeRecipients([
        { id: r.cb_id, name: r.cb_name, email: r.cb_email, wa: r.cb_wa, role: 'منشئ المشروع' },
      ]);
    }

    const delivered: Record<string, unknown>[] = [];
    if (!dry) {
      for (const rec of recipients) {
        if (rec.wa) await sendText(rec.wa, waBody).catch(() => null);
        if (rec.email)
          await sendEmail({
            from: 'notifications@antagna.me',
            to: [rec.email],
            subject: `متابعة عرض سعر — ${r.title} (${r.code})`,
            html: emailHtml,
          }).catch(() => null);
        delivered.push({ name: rec.name, role: rec.role, wa: !!rec.wa, email: !!rec.email });
      }
      sentMap[r.id] = new Date().toISOString();
    }
    report.push({
      code: r.code, title: r.title, client: r.client_name, quote_no: r.quote_no,
      stalledDays: daysAgo(r.last_email_at),
      recipients: dry ? recipients.map((x) => ({ name: x.name, role: x.role, wa: !!x.wa, email: !!x.email })) : delivered,
      suggestion,
    });
  }

  if (!dry && fresh.length > 0) {
    await db.execute(sql`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (${SENT_KEY}, ${JSON.stringify(sentMap)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `);
  }

  return NextResponse.json({
    ok: true,
    dry,
    scanned: rows.length,
    onCooldown: rows.length - fresh.length,
    notified: dry ? 0 : fresh.length,
    items: report,
  });
}

type Rec = { id: string | null; name: string | null; email: string | null; wa: string | null; role: string };
function dedupeRecipients(list: Rec[]): Rec[] {
  const seen = new Set<string>();
  const out: Rec[] = [];
  for (const r of list) {
    if (!r.id || (!r.email && !r.wa)) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}

async function suggestFollowup(r: Row): Promise<string> {
  try {
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.haiku,
      max_tokens: 220,
      system:
        'أنت مساعد متابعة مبيعات في شركة إنتاج سعودية. اكتب بالعربية المصرية البسيطة سطرين كحد أقصى: خطوة متابعة عملية واحدة أو اتنين لعرض سعر متوقف، أو لو واضح إنه مفيش تجاوب اقترح إلغاءه. مفيش مقدمات.',
      messages: [
        {
          role: 'user',
          content: `عرض سعر للعميل «${r.client_name ?? '—'}» (مشروع ${r.title}) لسه ما اتحوّلش لفاتورة. آخر إيميل ${relAr(r.last_email_at)}، آخر رد وارد من العميل ${relAr(r.last_inbound_at)}، آخر صادر مننا ${relAr(r.last_outbound_at)}. اقترح خطوة متابعة أو إلغاء.`,
        },
      ],
    });
    await recordUsage({ feature: 'quotation_followup', model: ANTHROPIC_MODELS.haiku, inputTokens: resp.usage.input_tokens ?? 0, outputTokens: resp.usage.output_tokens ?? 0, userId: null });
    const t = resp.content.find((b) => b.type === 'text');
    const txt = t && t.type === 'text' ? t.text.trim() : '';
    return txt || 'اقتراح: تواصل مع العميل لتأكيد العرض، ولو مفيش رد خلال يومين فكّر في إغلاق/إلغاء العرض.';
  } catch {
    return 'اقتراح: تواصل مع العميل لتأكيد العرض، ولو مفيش رد خلال يومين فكّر في إغلاق/إلغاء العرض.';
  }
}
