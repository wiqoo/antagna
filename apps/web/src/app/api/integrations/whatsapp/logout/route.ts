import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-admin';
import { logout } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const r = await logout();
    return NextResponse.json({ ok: r.ok });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
