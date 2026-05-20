import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { getAuthorizeUrl } from '@/lib/google';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Kick off Google OAuth. The user must be signed into Antagna to authorize.
 */
export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/admin/integrations/google');
  }

  const url = new URL(req.url);
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const authorizeUrl = getAuthorizeUrl(redirectUri, user.id);
  return NextResponse.redirect(authorizeUrl);
}
