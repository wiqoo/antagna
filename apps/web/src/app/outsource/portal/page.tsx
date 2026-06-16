import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requirePartner } from '../auth';
import { PortalHeader } from '../PortalHeader';
import { updateMyProfile } from '../portal-actions';
import { fmtSar, jobStatusLabel, jobStatusTone } from '../data';

export const dynamic = 'force-dynamic';

const field =
  'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]';
const lbl = 'mb-1 block text-[11px] text-[var(--text-muted)]';

interface Job {
  id: string; code: string; title: string; status: string;
  finalDueAt: string | null; agreedAmountSar: string | null; paid: string;
}

const ACTIVE = new Set(['in_progress', 'review', 'revisions']);

export default async function PortalDashboard() {
  const me = await requirePartner();

  const profileRows = (await db.execute(sql`
    SELECT name, contact_email AS "contactEmail", contact_phone AS "contactPhone"
    FROM partners WHERE id = ${me.partnerId}::uuid
  `)) as unknown as Array<{ name: string; contactEmail: string | null; contactPhone: string | null }>;
  const profile = profileRows[0];

  const jobs = (await db.execute(sql`
    SELECT j.id::text, j.code, j.title, j.status, j.final_due_at AS "finalDueAt",
           j.agreed_amount_sar AS "agreedAmountSar",
           (SELECT COALESCE(SUM(amount_sar),0) FROM external_payments ep WHERE ep.job_id = j.id) AS "paid"
    FROM external_jobs j
    WHERE j.partner_id = ${me.partnerId}::uuid AND j.status <> 'draft'
    ORDER BY j.created_at DESC
  `)) as unknown as Job[];

  const active = jobs.filter((j) => ACTIVE.has(j.status));
  const history = jobs.filter((j) => !ACTIVE.has(j.status));
  const totalAgreed = jobs.reduce((s, j) => s + Number(j.agreedAmountSar ?? 0), 0);
  const totalPaid = jobs.reduce((s, j) => s + Number(j.paid ?? 0), 0);
  const totalRemaining = totalAgreed - totalPaid;

  const card = (j: Job) => {
    const remaining = Number(j.agreedAmountSar ?? 0) - Number(j.paid ?? 0);
    return (
      <Link key={j.id} href={`/outsource/portal/${j.id}`} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5 hover:border-[var(--accent)]/50">
        <div>
          <div className="text-[14px] font-medium">{j.title}</div>
          <div className="text-[11px] text-[var(--text-dim)]">
            {j.code}{j.finalDueAt && <> · موعد {new Date(j.finalDueAt).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' })}</>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] text-[var(--text-muted)]">مستحق لك {fmtSar(remaining)}</span>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: 'var(--surface2)', color: jobStatusTone(j.status) }}>
            {jobStatusLabel(j.status)}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <>
      <PortalHeader name={me.displayName} />
      <main className="mx-auto max-w-3xl px-5 py-7">
        <h1 className="mb-1 text-[20px] font-semibold">أهلاً {me.displayName ?? profile?.name ?? ''} 👋</h1>
        <p className="mb-5 text-[12px] text-[var(--text-dim)]">مشاريعك مع Volt Production</p>

        {/* account summary */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
            <div className="text-[11px] text-[var(--text-dim)]">إجمالي المتفق</div>
            <div className="text-[18px] font-bold tabular-nums">{fmtSar(totalAgreed)}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
            <div className="text-[11px] text-[var(--text-dim)]">المدفوع لك</div>
            <div className="text-[18px] font-bold tabular-nums text-[var(--success)]">{fmtSar(totalPaid)}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
            <div className="text-[11px] text-[var(--text-dim)]">المتبقي لك</div>
            <div className="text-[18px] font-bold tabular-nums text-[var(--warning)]">{fmtSar(totalRemaining)}</div>
          </div>
        </div>

        {/* current */}
        <h2 className="mb-2.5 text-[14px] font-semibold">المشاريع الحالية</h2>
        <div className="mb-6 flex flex-col gap-2.5">
          {active.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line)] py-8 text-center text-[12.5px] text-[var(--text-dim)]">لا مشاريع حالية.</div>
          ) : active.map(card)}
        </div>

        {/* history */}
        {history.length > 0 && (
          <>
            <h2 className="mb-2.5 text-[14px] font-semibold">المشاريع السابقة</h2>
            <div className="mb-6 flex flex-col gap-2.5 opacity-80">{history.map(card)}</div>
          </>
        )}

        {/* editable profile */}
        <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <summary className="cursor-pointer text-[13px] font-semibold">بياناتك</summary>
          <form action={updateMyProfile} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={lbl}>الاسم</label><input name="name" defaultValue={me.displayName ?? ''} className={field} /></div>
            <div><label className={lbl}>البريد</label><input name="contact_email" type="email" defaultValue={profile?.contactEmail ?? ''} className={field} /></div>
            <div><label className={lbl}>الجوال</label><input name="contact_phone" defaultValue={profile?.contactPhone ?? ''} className={field} /></div>
            <div className="sm:col-span-2"><button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[#1a1a1a] hover:bg-[var(--accent-hover)]">حفظ</button></div>
          </form>
        </details>
      </main>
    </>
  );
}
