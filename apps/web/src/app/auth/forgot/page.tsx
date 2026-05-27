import Link from 'next/link';
import { AuthCard, authField, authButton } from '@/components/AuthCard';
import { requestPasswordReset } from '../actions';

export const dynamic = 'force-dynamic';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ForgotPasswordPage(props: { searchParams: SP }) {
  const p = await props.searchParams;
  const sent = p.sent === '1';
  const error = typeof p.error === 'string' ? p.error : null;

  return (
    <AuthCard
      title="استعادة كلمة المرور"
      subtitle="أدخل بريدك وسنرسل لك رابطاً آمناً لإعادة التعيين · Reset your password"
      footer={
        <>
          تذكّرتها؟{' '}
          <Link href="/login" className="text-[#FF6B1A] hover:underline">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-[13px] leading-relaxed text-emerald-300">
          إن كان هذا البريد مسجّلاً لدينا، فستصلك رسالة تتضمّن رابط إعادة التعيين خلال
          دقائق. تحقّق من صندوق الوارد ومجلد البريد المزعج.
        </div>
      ) : (
        <form action={requestPasswordReset} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[13px] text-white/60">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              dir="ltr"
              autoComplete="email"
              className={authField}
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
              {error}
            </p>
          )}
          <button type="submit" className={authButton}>
            إرسال رابط الاستعادة
          </button>
        </form>
      )}
    </AuthCard>
  );
}
