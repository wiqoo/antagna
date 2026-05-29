import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard, authField, authButton } from '@/components/AuthCard';
import { registerAction } from './actions';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RegisterPage(props: { searchParams: SearchParams }) {
  // D-040 — invite-only. With self-signup off (default), bounce to /login with
  // the Arabic notice. Reversible: set REGISTRATION_OPEN=true to show the form.
  if (process.env.REGISTRATION_OPEN !== 'true') {
    redirect(`/login?message=${encodeURIComponent('التسجيل بالدعوة فقط')}`);
  }

  const params = await props.searchParams;
  const error = typeof params.error === 'string' ? params.error : null;

  return (
    <AuthCard
      title="إنشاء حساب في Antagna"
      subtitle="أي بريد يعمل — سيُسنِد المدير دورك بعد التسجيل · Admin assigns your role"
      footer={
        <>
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="text-[#FF6B1A] hover:underline">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <form action={registerAction} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="full_name" className="block text-[13px] text-white/60">
            الاسم الكامل
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            autoFocus
            className={authField}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-[13px] text-white/60">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            className={authField}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-[13px] text-white/60">
            كلمة المرور
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            dir="ltr"
            className={authField}
          />
          <p className="text-[12px] text-white/30">8 أحرف على الأقل.</p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </p>
        )}

        <button type="submit" className={authButton}>
          إنشاء الحساب
        </button>
      </form>
    </AuthCard>
  );
}
