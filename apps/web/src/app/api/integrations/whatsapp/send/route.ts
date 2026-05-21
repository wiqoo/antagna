import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-admin';
import { sendText } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

interface SendBody {
  to?: string;
  body?: string;
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let payload: SendBody = {};
  try {
    payload = (await req.json()) as SendBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!payload.to || !payload.body) {
    return NextResponse.json(
      { ok: false, error: 'to + body required' },
      { status: 400 },
    );
  }

  try {
    const res = await sendText(payload.to, payload.body);
    return NextResponse.json(
      { ok: res.ok, messageId: res.messageId, raw: res.raw },
      { status: res.ok ? 200 : 502 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
