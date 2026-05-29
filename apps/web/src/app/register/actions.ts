'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * D-040 — Antagna is INVITE-ONLY. Public self-signup is OFF.
 *
 * The whole self-registration flow below is kept intact but hard-gated behind
 * REGISTRATION_OPEN so the decision is fully reversible: set the env var to
 * 'true' to re-enable open signup without restoring any deleted code. New users
 * arrive via /admin/invite-user (position assigned at invite time); a self-made
 * account would have no position_key → no access (D-040 rationale).
 */
// Internal helper (NOT exported — a 'use server' module may only export async
// Server Actions). The register page reads process.env.REGISTRATION_OPEN directly.
function registrationOpen(): boolean {
  return process.env.REGISTRATION_OPEN === 'true';
}

const INVITE_ONLY_MESSAGE = 'التسجيل بالدعوة فقط';

function siteOrigin(reqOrigin: string | null): string {
  return (
    reqOrigin ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    'http://localhost:3000'
  );
}

export async function registerAction(formData: FormData) {
  // Hard gate: invite-only (D-040). Reversible via REGISTRATION_OPEN=true.
  if (!registrationOpen()) {
    redirect(`/login?message=${encodeURIComponent(INVITE_ONLY_MESSAGE)}`);
  }

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();

  if (!email || !password || !fullName) {
    redirect(`/register?error=${encodeURIComponent('جميع الحقول مطلوبة')}`);
  }
  if (password.length < 8) {
    redirect(`/register?error=${encodeURIComponent('كلمة المرور 8 أحرف على الأقل')}`);
  }

  const origin = siteOrigin((await headers()).get('origin'));
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // Email-verification link lands on our PKCE callback, which exchanges the
      // code for a session and forwards on.
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/', 'layout');
  // If email confirmation is required, session is null and the user lands on login
  // with a message. Otherwise they're already signed in and we go to dashboard.
  redirect(
    '/login?message=' +
      encodeURIComponent('تم إنشاء الحساب. تحقّق من بريدك إن طُلب التفعيل، ثم سجّل الدخول.'),
  );
}
