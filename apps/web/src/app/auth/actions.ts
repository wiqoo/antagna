'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';

function siteOrigin(reqOrigin: string | null): string {
  return (
    reqOrigin ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    'http://localhost:3000'
  );
}

/** Send a password-reset email. Always reports success (no account enumeration). */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) {
    redirect('/auth/forgot?error=' + encodeURIComponent('البريد الإلكتروني مطلوب'));
  }
  const origin = siteOrigin((await headers()).get('origin'));
  const supabase = await getSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset`,
  });
  redirect('/auth/forgot?sent=1');
}

/** Set a new password (after the reset link established a session via /auth/callback). */
export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) {
    redirect('/auth/reset?error=' + encodeURIComponent('كلمة المرور 8 أحرف على الأقل'));
  }
  if (password !== confirm) {
    redirect('/auth/reset?error=' + encodeURIComponent('كلمتا المرور غير متطابقتين'));
  }
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      '/auth/forgot?error=' +
        encodeURIComponent('انتهت صلاحية الجلسة. اطلب رابط استعادة جديداً.'),
    );
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect('/auth/reset?error=' + encodeURIComponent(error.message));
  }
  redirect('/login?message=' + encodeURIComponent('تم تحديث كلمة المرور. سجّل الدخول الآن.'));
}
