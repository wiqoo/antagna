import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { exchangeCodeAndStore } from '@/lib/google';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Google redirects here after the user authorizes. We exchange the code for
 * tokens, persist them, then bounce back to the admin page with a status.
 */
export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
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
