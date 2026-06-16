import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { acceptInvite } from '../../session-actions';

export const dynamic = 'force-dynamic';

const field =
  'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]';

const ERR: Record<string, string> = {
  invalid: 'الدعوة غير صالحة أو منتهية أو مُستخدمة بالفعل.',
  weak: 'أدخل بريداً صحيحاً وكلمة مرور لا تقل عن ٦ أحرف.',
  exists: 'هذا البريد مستخدم بالفعل — جرّب تسجيل الدخول.',
};

export default async function InvitePage({
  params, searchParams,
}: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;

  const rows = (await db.execute(sql`
    SELECT p.name AS "partnerName", pi.accepted_at AS "acceptedAt", (pi.expires_at < now()) AS "expired", pi.email
    FROM partner_invites pi JOIN partners p ON p.id = pi.partner_id
    WHERE pi.token = ${token}::uuid
  `)) as unknown as Array<{ partnerName: string; acceptedAt: string | null; expired: boolean; email: string | null }>;
  const inv = rows[0];
  const usable = inv && !inv.acceptedAt && !inv.expired;

  return (
    <div className="grid min-h-[100dvh] place-items-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent)] text-[17px] font-bold text-[#1a1a1a]">V</span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold">دعوة شريك</div>
            <div className="text-[11px] text-[var(--text-dim)]">Volt Production · المشاريع الخارجية</div>
          </div>
        </div>

        {!usable ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3.5 py-3 text-[13px] text-[var(--danger)]">
            {inv?.acceptedAt ? 'تم استخدام هذه الدعوة بالفعل.' : 'الدعوة غير صالحة أو منتهية.'}
            <div className="mt-2"><a href="/outsource/login" className="text-[var(--accent)]">تسجيل الدخول ←</a></div>
          </div>
        ) : (
          <>
            <h1 className="mb-1 text-[19px] font-semibold">أهلاً {inv.partnerName} 👋</h1>
            <p className="mb-5 text-[12.5px] text-[var(--text-dim)]">أنشئ حسابك للدخول ومتابعة مشاريعك مع Volt.</p>
            {error && (
              <div className="mb-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-[12.5px] text-[var(--danger)]">
                {ERR[error] ?? 'تعذّر إنشاء الحساب.'}
              </div>
            )}
            <form action={acceptInvite.bind(null, token)} className="flex flex-col gap-3">
              <input name="name" placeholder="اسمك" className={field} />
              <input name="email" type="email" required defaultValue={inv.email ?? ''} placeholder="البريد الإلكتروني" className={field} />
              <input name="password" type="password" required minLength={6} placeholder="كلمة مرور (٦ أحرف على الأقل)" className={field} />
              <button className="mt-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-[14px] font-medium text-[#1a1a1a] hover:bg-[var(--accent-hover)]">
                إنشاء الحساب والدخول
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
