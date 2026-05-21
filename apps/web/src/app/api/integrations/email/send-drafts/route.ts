/**
 * POST /api/integrations/email/send-drafts — scan email_drafts for approved
 * ready-to-send rows and send each via Resend. Called by the
 * email-send-scanner Trigger.dev task every minute.
 */
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-admin';
import { sendApprovedDrafts } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  const url = new URL(req.url);
  const max = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get('max') ?? '20', 10) || 20),
  );

  try {
    const report = await sendApprovedDrafts(max);
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
