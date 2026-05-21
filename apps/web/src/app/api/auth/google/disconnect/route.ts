import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, googleIntegrations } from '@antagna/db';
import { getAdminUser } from '@/lib/auth-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const form = await req.formData();
  const email = form.get('email');
  if (typeof email !== 'string' || !email) {
    return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });
  }

  await db
    .update(googleIntegrations)
    .set({ disconnectedAt: new Date(), updatedAt: new Date() })
    .where(eq(googleIntegrations.email, email));

  const url = new URL(req.url);
  return NextResponse.redirect(
    new URL('/admin/integrations/google?disconnected=1', url.origin),
    { status: 303 },
  );
}
