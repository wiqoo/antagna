import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-admin';
import { getConnectionState, getQrCode } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const conn = await getConnectionState();
    if (conn.state === 'connecting') {
      const qr = await getQrCode();
      return NextResponse.json({
        ok: true,
        state: conn.state,
        qr: { base64: qr.base64, pairingCode: qr.pairingCode },
      });
    }
    return NextResponse.json({ ok: true, state: conn.state ?? 'unknown' });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
