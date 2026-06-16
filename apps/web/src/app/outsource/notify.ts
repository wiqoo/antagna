import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { sendEmail } from '@/lib/email';

// Email notifications for the external-work module. All sends are best-effort
// (never block the action) — wrapped by callers in a fire-and-forget catch.

const BASE = process.env.ANTAGNA_BASE_URL ?? 'https://antagna.me';
const FROM = 'notifications@antagna.me';

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
function wrap(title: string, bodyHtml: string, ctaText: string, ctaUrl: string): string {
  return `<div dir="rtl" style="font-family:system-ui,Arial;line-height:1.7;color:#1a1a1a">
    <h3 style="margin:0 0 8px">${esc(title)}</h3>
    ${bodyHtml}
    <p style="margin:14px 0 0"><a href="${ctaUrl}" style="background:#FF6B1A;color:#1a1a1a;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:600;display:inline-block">${esc(ctaText)}</a></p>
    <p style="margin:16px 0 0;color:#888;font-size:12px">Volt Production · المشاريع الخارجية</p>
  </div>`;
}

interface JobRecipients {
  title: string;
  code: string;
  partnerName: string | null;
  partnerEmail: string | null;
  voltEmail: string | null;
}

async function recipients(jobId: string): Promise<JobRecipients | null> {
  const rows = (await db.execute(sql`
    SELECT j.title, j.code, p.name AS "partnerName",
      COALESCE(
        (SELECT u.email FROM ext_users e JOIN auth.users u ON u.id = e.auth_user_id
         WHERE e.partner_id = j.partner_id AND e.role = 'partner' ORDER BY e.created_at DESC LIMIT 1),
        p.contact_email
      ) AS "partnerEmail",
      (SELECT pr.email FROM profiles pr WHERE pr.id = j.created_by) AS "voltEmail"
    FROM external_jobs j LEFT JOIN partners p ON p.id = j.partner_id
    WHERE j.id = ${jobId}::uuid
  `)) as unknown as JobRecipients[];
  return rows[0] ?? null;
}

/** Volt invited a partner — send the registration link. */
export async function notifyInvite(opts: { to: string | null; partnerName: string | null; token: string }): Promise<void> {
  if (!opts.to) return;
  const url = `${BASE}/outsource/invite/${opts.token}`;
  await sendEmail({
    from: FROM,
    to: [opts.to],
    subject: 'دعوة للعمل مع Volt Production',
    html: wrap(
      `أهلاً ${opts.partnerName ?? ''} 👋`,
      `<p style="margin:0">دعتك Volt Production للعمل معها على المشاريع الخارجية. أنشئ حسابك لمتابعة مشاريعك والتسليمات.</p>`,
      'إنشاء الحساب',
      url,
    ),
  }).catch(() => null);
}

/** Volt requested a revision — notify the partner. */
export async function notifyRevisionRequested(jobId: string, note: string): Promise<void> {
  const r = await recipients(jobId);
  if (!r?.partnerEmail) return;
  await sendEmail({
    from: FROM,
    to: [r.partnerEmail],
    subject: `طلب تعديل — ${r.title} (${r.code})`,
    html: wrap(
      `🔄 طلب تعديل جديد — ${r.title}`,
      `<p style="margin:0">طلبت Volt تعديلاً: «${esc(note)}». افتح مشروعك لرفع نسختك المحدّثة.</p>`,
      'فتح المشروع',
      `${BASE}/outsource/portal/${jobId}`,
    ),
  }).catch(() => null);
}

/** Partner submitted a version — notify Volt. */
export async function notifyVersionSubmitted(jobId: string): Promise<void> {
  const r = await recipients(jobId);
  if (!r?.voltEmail) return;
  await sendEmail({
    from: FROM,
    to: [r.voltEmail],
    subject: `نسخة جديدة من الشريك — ${r.title} (${r.code})`,
    html: wrap(
      `▶ ${r.partnerName ?? 'الشريك'} رفع نسخة — ${r.title}`,
      `<p style="margin:0">رفع الشريك نسخة جديدة للمراجعة.</p>`,
      'مراجعة المشروع',
      `${BASE}/outsource/${jobId}`,
    ),
  }).catch(() => null);
}

/** Partner delivered the final — notify Volt. */
export async function notifyFinalDelivered(jobId: string): Promise<void> {
  const r = await recipients(jobId);
  if (!r?.voltEmail) return;
  await sendEmail({
    from: FROM,
    to: [r.voltEmail],
    subject: `تم التسليم — ${r.title} (${r.code})`,
    html: wrap(
      `✓ ${r.partnerName ?? 'الشريك'} سلّم الفاينل — ${r.title}`,
      `<p style="margin:0">رفع الشريك الملف النهائي. افتح المشروع للمعاينة والتحميل.</p>`,
      'فتح المشروع',
      `${BASE}/outsource/${jobId}`,
    ),
  }).catch(() => null);
}
