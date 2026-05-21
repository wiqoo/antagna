import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-admin';
import { getConnectionState, getQrCode } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/**
 * Connection state + QR (when connecting). WPPConnect's qrcode-session is
 * a side-effect-free read, so it's safe to poll alongside status.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const conn = await getConnectionState();
    const state = conn.state ?? 'unknown';
    if (state === 'connecting') {
      const qr = await getQrCode();
      return NextResponse.json({
        ok: true,
        state,
        qr: qr.base64 ? { base64: qr.base64, pairingCode: qr.pairingCode } : undefined,
      });
    }
    return NextResponse.json({ ok: true, state });
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
