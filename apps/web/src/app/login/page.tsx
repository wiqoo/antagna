import Link from 'next/link';
import { AuthCard, authField, authButton } from '@/components/AuthCard';
import { loginAction } from './actions';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const error = typeof params.error === 'string' ? params.error : null;
  const message = typeof params.message === 'string' ? params.message : null;
  const next = typeof params.next === 'string' ? params.next : '/';

  return (
    <AuthCard
      title="تسجيل الدخول إلى Antagna"
      subtitle="استخدم بريد العمل وكلمة المرور · Sign in with your work email"
      footer={
        <>
          لا تملك حساباً؟{' '}
          <Link href="/register" className="text-[#FF6B1A] hover:underline">
            إنشاء حساب
          </Link>
        </>
      }
    >
      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />

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
            autoFocus
            dir="ltr"
            className={authField}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-[13px] text-white/60">
              كلمة المرور
            </label>
            <Link
              href="/auth/forgot"
              className="text-[12px] text-white/40 hover:text-[#FF6B1A]"
            >
              نسيت كلمة المرور؟
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            minLength={8}
            dir="ltr"
            className={authField}
          />
        </div>

        {message && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </p>
        )}

        <button type="submit" className={authButton}>
          تسجيل الدخول
        </button>
      </form>
    </AuthCard>
  );
}
