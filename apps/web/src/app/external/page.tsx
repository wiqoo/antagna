import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { fmtSar, jobStatusLabel, jobStatusTone, isComplete } from './data';
import { requireVolt } from './auth';
import { ManageHeader } from './ManageHeader';

export const dynamic = 'force-dynamic';

interface JobRow {
  id: string;
  code: string;
  title: string;
  partnerName: string | null;
  partnerKind: string | null;
  projectCode: string | null;
  status: string;
  finalDueAt: string | null;
  agreedAmountSar: string | null;
  paid: string | null;
  materialCount: number;
  scope: string | null;
  brief: string | null;
  partnerId: string | null;
}

export default async function ExternalJobsPage() {
  const me = await requireVolt();
  const jobs = (await db.execute(sql`
    SELECT j.id::text, j.code, j.title, j.status,
           j.final_due_at AS "finalDueAt", j.agreed_amount_sar AS "agreedAmountSar",
           j.scope, j.brief, j.partner_id::text AS "partnerId",
           p.name AS "partnerName", p.kind AS "partnerKind",
           pr.code AS "projectCode",
           (SELECT COALESCE(SUM(amount_sar),0) FROM external_payments ep WHERE ep.job_id = j.id) AS "paid",
           (SELECT COUNT(*)::int FROM external_links el WHERE el.entity_type='external_job' AND el.entity_id = j.id) AS "materialCount"
    FROM external_jobs j
    LEFT JOIN partners p ON p.id = j.partner_id
    LEFT JOIN projects pr ON pr.id = j.project_id
    ORDER BY j.created_at DESC
  `)) as unknown as JobRow[];

  const owed = jobs.reduce(
    (s, j) => s + (Number(j.agreedAmountSar ?? 0) - Number(j.paid ?? 0)),
    0,
  );
  const active = jobs.filter((j) => j.status === 'in_progress' || j.status === 'review' || j.status === 'revisions').length;

  return (
    <>
      <ManageHeader name={me.displayName} />
      <main className="mx-auto max-w-5xl px-5 py-7">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-semibold">الشغل الخارجي</h1>
          <p className="text-[12px] text-[var(--text-dim)]">
            {jobs.length} شغلات · {active} قيد العمل · مستحق علينا {fmtSar(owed)} ر.س
          </p>
        </div>
        <Link href="/external/new" className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium text-[#1a1a1a] hover:bg-[var(--accent-hover)]">
          + شغلة جديدة
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-16 text-center text-[var(--text-dim)]">
          لا شغلات بعد — ابدأ بإضافة شغلة جديدة.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-[11px] text-[var(--text-dim)]">
                <th className="px-3 py-2.5 text-start font-medium">الكود</th>
                <th className="px-3 py-2.5 text-start font-medium">الشغلة</th>
                <th className="px-3 py-2.5 text-start font-medium">الشريك</th>
                <th className="px-3 py-2.5 text-start font-medium">الحالة</th>
                <th className="px-3 py-2.5 text-start font-medium">الموعد</th>
                <th className="px-3 py-2.5 text-start font-medium">مدفوع/متفق</th>
                <th className="px-3 py-2.5 text-start font-medium">الاكتمال</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const complete = isComplete({
                  brief: j.brief, scope: j.scope, partnerId: j.partnerId,
                  finalDueAt: j.finalDueAt, agreedAmountSar: j.agreedAmountSar, materialCount: j.materialCount,
                });
                return (
                  <tr key={j.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="px-3 py-3 font-mono text-[12px] text-[var(--text-dim)]">
                      <Link href={`/external/${j.id}`} className="block">{j.code}</Link>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/external/${j.id}`} className="block font-medium hover:text-[var(--accent)]">
                        {j.title}
                        {j.projectCode && <span className="mr-1.5 text-[10px] text-[var(--text-dim)]">↳ {j.projectCode}</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[var(--text-muted)]">
                      {j.partnerName ?? <span className="text-[var(--text-dim)]">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: 'var(--surface2)', color: jobStatusTone(j.status) }}>
                        {jobStatusLabel(j.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[var(--text-muted)]">
                      {j.finalDueAt ? new Date(j.finalDueAt).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' }) : <span className="text-[var(--text-dim)]">—</span>}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {j.agreedAmountSar ? `${fmtSar(Number(j.paid))} / ${fmtSar(Number(j.agreedAmountSar))}` : <span className="text-[var(--text-dim)]">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span style={{ color: complete ? 'var(--success)' : 'var(--warning)' }}>● {complete ? 'مكتمل' : 'ناقص'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2.5 text-[11px] text-[var(--text-dim)]">● مكتمل = جاهز للإرسال للشريك · ● ناقص = أكمل البيانات أولاً.</p>
      </main>
    </>
  );
}
