import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { exchangeCodeAndStore } from '@/lib/google';
import { getAdminUser } from '@/lib/auth-admin';

export const dynamic = 'force-dynamic';

/**
 * Google redirects here after the user authorizes. Admin-only — the same
 * guard as /connect, so an unauthorized user can't trick the callback into
 * storing tokens on their behalf.
 */
export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    redirect('/login?next=/admin/integrations/google');
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/integrations/google?error=${encodeURIComponent(error)}`,
        url.origin,
      ),
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL('/admin/integrations/google?error=missing_code', url.origin),
    );
  }

  try {
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const email = await exchangeCodeAndStore(code, redirectUri);
    return NextResponse.redirect(
      new URL(
        `/admin/integrations/google?connected=${encodeURIComponent(email)}`,
        url.origin,
      ),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(
        `/admin/integrations/google?error=${encodeURIComponent(msg)}`,
        url.origin,
      ),
    );
  }
}
