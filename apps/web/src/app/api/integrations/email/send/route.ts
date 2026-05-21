/**
 * POST /api/integrations/email/send — one-shot transactional send.
 *
 * Admin OR Bearer CRON_SECRET (worker). Body:
 *   {
 *     from?: string,           // defaults to noreply@antagna.me
 *     to: string[],
 *     cc?: string[],
 *     bcc?: string[],
 *     replyTo?: string,
 *     subject: string,
 *     html?: string,
 *     text?: string
 *   }
 */
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-admin';
import { sendEmail, type SendEmailInput } from '@/lib/email';

export const dynamic = 'force-dynamic';

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

  let body: Partial<SendEmailInput> = {};
  try {
    body = (await req.json()) as Partial<SendEmailInput>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!body.to?.length || !body.subject) {
    return NextResponse.json(
      { ok: false, error: 'to[] and subject required' },
      { status: 400 },
    );
  }

  const r = await sendEmail({
    from: body.from ?? 'noreply@antagna.me',
    to: body.to,
    cc: body.cc,
    bcc: body.bcc,
    replyTo: body.replyTo,
    subject: body.subject,
    html: body.html,
    text: body.text,
  });

  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
