import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-admin';
import { createInstance, getQrCode } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/**
 * Bring up the instance + return a fresh QR. Idempotent — if the instance
 * already exists Evolution returns it and we just fetch the QR.
 */
export async function POST() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    await createInstance();
    const qr = await getQrCode();
    return NextResponse.json({
      ok: true,
      qr: { base64: qr.base64, pairingCode: qr.pairingCode },
    });
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
