'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function registerAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();

  if (!email || !password || !fullName) {
    redirect(`/register?error=${encodeURIComponent('All fields are required')}`);
  }
  if (password.length < 8) {
    redirect(`/register?error=${encodeURIComponent('Password must be at least 8 characters')}`);
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/', 'layout');
  // If email confirmation is required, session is null and the user lands on login
  // with a message. Otherwise they're already signed in and we go to dashboard.
  redirect('/login?message=' + encodeURIComponent('Account created. Sign in to continue.'));
}
