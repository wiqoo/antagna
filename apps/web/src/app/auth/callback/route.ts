/**
 * Supabase PKCE callback. Handles the redirect from a magic link / password-reset
 * / email-verification email: exchange the `code` for a session (sets cookies),
 * then continue to `next` (e.g. /auth/reset to choose a new password, or /dashboard
 * after email verification). Lives under /auth so the middleware treats it public.
 */
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  // Some Supabase email links use the OTP token-hash form instead of a PKCE code.
  const tokenHash = url.searchParams.get('token_hash');
  const otpType = url.searchParams.get('type');
  const next = url.searchParams.get('next') ?? '/dashboard';
  // Only allow same-origin relative redirects.
  const safeNext = next.startsWith('/') ? next : '/dashboard';

  if (code || (tokenHash && otpType)) {
    const supabase = await getSupabaseServerClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabase.auth.verifyOtp({ type: otpType as any, token_hash: tokenHash! });
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL(
      '/login?error=' +
        encodeURIComponent('انتهت صلاحية الرابط أو أنه غير صالح. حاول مرة أخرى.'),
      url.origin,
    ),
  );
}
