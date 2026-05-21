import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { getAuthorizeUrl } from '@/lib/google';
import { getAdminUser } from '@/lib/auth-admin';

export const dynamic = 'force-dynamic';

/**
 * Kick off Google OAuth. Admin-only.
 */
export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    redirect('/login?next=/admin/integrations/google');
  }

  const url = new URL(req.url);
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const authorizeUrl = getAuthorizeUrl(redirectUri, admin.user.id);
  return NextResponse.redirect(authorizeUrl);
}
