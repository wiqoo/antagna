import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getRealProfile } from '@/lib/view-as';
import { signOutAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * "Awaiting admin approval" screen for self-registered accounts that aren't
 * 'active' yet (open registration + admin approval). Standalone — does NOT use
 * Shell (Shell is what redirects non-active accounts here, so rendering Shell
 * would loop). An active account that lands here is sent on to the dashboard.
 */
export default async function PendingPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const real = await getRealProfile();
  if (real && real.status === 'active') redirect('/dashboard');

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--bg)] px-6 text-[var(--text)]">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl"
          style={{ background: 'var(--accent-tint)' }}
        >
          ⏳
        </div>
        <h1
          className="mt-6 text-[26px] font-bold tracking-[-0.018em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          حسابك بانتظار موافقة الإدارة
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-muted)]">
          تم إنشاء حسابك بنجاح ({user.email}). سيراجعه أحد المسؤولين ويُفعّله
          قريبًا. ستتمكن من الدخول بمجرد الموافقة — جرّب تسجيل الدخول لاحقًا.
        </p>
        <form action={signOutAction} className="mt-8">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-5 text-[13px] font-medium text-[var(--text)] hover:border-[var(--line-strong)]"
          >
            تسجيل الخروج
          </button>
        </form>
      </div>
    </main>
  );
}
