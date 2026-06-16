import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requirePartner } from '../auth';
import { PortalHeader } from '../PortalHeader';
import { fmtSar, jobStatusLabel, jobStatusTone } from '../data';

export const dynamic = 'force-dynamic';

export default async function PortalListPage() {
  const me = await requirePartner();
  const jobs = (await db.execute(sql`
    SELECT j.id::text, j.code, j.title, j.status, j.final_due_at AS "finalDueAt",
           j.agreed_amount_sar AS "agreedAmountSar",
           (SELECT COALESCE(SUM(amount_sar),0) FROM external_payments ep WHERE ep.job_id = j.id) AS "paid"
    FROM external_jobs j
    WHERE j.partner_id = ${me.partnerId}::uuid AND j.status <> 'draft'
    ORDER BY j.created_at DESC
  `)) as unknown as Array<{ id: string; code: string; title: string; status: string; finalDueAt: string | null; agreedAmountSar: string | null; paid: string }>;

  return (
    <>
      <PortalHeader name={me.displayName} />
      <main className="mx-auto max-w-3xl px-5 py-7">
        <h1 className="mb-1 text-[20px] font-semibold">شغلاتك</h1>
        <p className="mb-5 text-[12px] text-[var(--text-dim)]">المهام المطلوبة منك مع Volt Production</p>
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] py-14 text-center text-[var(--text-dim)]">
            لا شغلات حالياً.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {jobs.map((j) => {
              const remaining = Number(j.agreedAmountSar ?? 0) - Number(j.paid ?? 0);
              return (
                <Link key={j.id} href={`/external/portal/${j.id}`} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5 hover:border-[var(--accent)]/50">
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
            })}
          </div>
        )}
      </main>
    </>
  );
}
