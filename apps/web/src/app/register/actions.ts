'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
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

export async function registerAction(formData: FormData) {
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
