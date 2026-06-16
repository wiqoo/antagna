import { login } from '../session-actions';

export const dynamic = 'force-dynamic';

const field =
  'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]';

const ERR: Record<string, string> = {
  bad: 'بريد أو كلمة مرور غير صحيحة.',
  missing: 'أدخل البريد وكلمة المرور.',
  noaccess: 'هذا الحساب غير مصرّح له بالدخول لهذا النظام.',
};

export default async function ExternalLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="grid min-h-[100dvh] place-items-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent)] text-[17px] font-bold text-[#1a1a1a]">V</span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold">المشاريع الخارجية</div>
            <div className="text-[11px] text-[var(--text-dim)]">Volt Production</div>
          </div>
        </div>
        <h1 className="mb-1 text-[19px] font-semibold">تسجيل الدخول</h1>
        <p className="mb-5 text-[12.5px] text-[var(--text-dim)]">للفريق والشركاء</p>

        {error && (
          <div className="mb-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-[12.5px] text-[var(--danger)]">
            {ERR[error] ?? 'تعذّر الدخول.'}
          </div>
        )}

        <form action={login} className="flex flex-col gap-3">
          <input name="email" type="email" required placeholder="البريد الإلكتروني" className={field} />
          <input name="password" type="password" required placeholder="كلمة المرور" className={field} />
          <button className="mt-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-[14px] font-medium text-[#1a1a1a] hover:bg-[var(--accent-hover)]">
            دخول
          </button>
        </form>
        <p className="mt-5 text-[11px] text-[var(--text-dim)]">الشركاء: استخدم رابط الدعوة المُرسل إليك لإنشاء حسابك أول مرة.</p>
      </div>
    </div>
  );
}
