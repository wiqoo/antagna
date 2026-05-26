import Link from 'next/link';
import { AuthCard, authField, authButton } from '@/components/AuthCard';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { updatePassword } from '../actions';

export const dynamic = 'force-dynamic';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage(props: { searchParams: SP }) {
  const p = await props.searchParams;
  const error = typeof p.error === 'string' ? p.error : null;

  // /auth/callback exchanged the reset code for a session before redirecting here.
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthCard
        title="رابط غير صالح"
        subtitle="انتهت صلاحية رابط الاستعادة أو أنه غير صالح · This reset link is invalid or expired"
      >
        <Link href="/auth/forgot" className={authButton + ' inline-block text-center'}>
          اطلب رابطاً جديداً
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="كلمة مرور جديدة"
      subtitle="اختر كلمة مرور جديدة لحسابك · Choose a new password"
    >
      <form action={updatePassword} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-[13px] text-white/60">
            كلمة المرور الجديدة
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            minLength={8}
            dir="ltr"
            autoComplete="new-password"
            className={authField}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm" className="block text-[13px] text-white/60">
            تأكيد كلمة المرور
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            dir="ltr"
            autoComplete="new-password"
            className={authField}
          />
        </div>
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </p>
        )}
        <button type="submit" className={authButton}>
          حفظ كلمة المرور
        </button>
      </form>
    </AuthCard>
  );
}
