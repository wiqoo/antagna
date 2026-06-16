import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requirePartner } from '../../auth';
import { PortalHeader } from '../../PortalHeader';
import { fmtSar, jobStatusLabel, jobStatusTone } from '../../data';
import { FinalUpload } from '../../[id]/FinalUpload';
import { portalSubmitVersion } from '../../portal-actions';

export const dynamic = 'force-dynamic';
const BUCKET = 'antagna-attachments';
const field = 'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--accent)]';
const dateAr = (d: string | null) => (d ? new Date(d).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default async function PortalJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requirePartner();

  const jobs = (await db.execute(sql`
    SELECT j.id::text, j.code, j.title, j.status, j.brief, j.final_due_at AS "finalDueAt",
           j.agreed_amount_sar AS "agreedAmountSar",
           a.id::text AS "finalId", a.storage_path AS "finalPath", a.mime_type AS "finalMime", a.filename AS "finalName"
    FROM external_jobs j
    LEFT JOIN attachments a ON a.id = j.final_attachment_id
    WHERE j.id = ${id}::uuid AND j.partner_id = ${me.partnerId}::uuid AND j.status <> 'draft'
  `)) as unknown as Array<{ id: string; code: string; title: string; status: string; brief: string | null; finalDueAt: string | null; agreedAmountSar: string | null; finalId: string | null; finalPath: string | null; finalMime: string | null; finalName: string | null }>;
  const job = jobs[0];
  if (!job) notFound();

  const [revisions, links, payments] = (await Promise.all([
    db.execute(sql`SELECT id::text, round_number AS "roundNumber", change_request AS "changeRequest", version_url AS "versionUrl", status FROM external_job_revisions WHERE job_id = ${id}::uuid ORDER BY round_number`),
    db.execute(sql`SELECT id::text, provider, url, label FROM external_links WHERE entity_type='external_job' AND entity_id = ${id}::uuid ORDER BY created_at`),
    db.execute(sql`SELECT COALESCE(SUM(amount_sar),0) AS "paid" FROM external_payments WHERE job_id = ${id}::uuid`),
  ])) as unknown as [Array<{ id: string; roundNumber: number; changeRequest: string | null; versionUrl: string | null; status: string }>, Array<{ id: string; provider: string; url: string; label: string | null }>, Array<{ paid: string }>];

  const paid = Number(payments[0]?.paid ?? 0);
  const agreed = Number(job.agreedAmountSar ?? 0);

  let finalUrl: string | null = null;
  if (job.finalPath) {
    try {
      const { data } = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrl(job.finalPath, 3600);
      finalUrl = data?.signedUrl ?? null;
    } catch { /* ignore */ }
  }

  return (
    <>
      <PortalHeader name={me.displayName} />
      <main className="mx-auto max-w-3xl px-5 py-7">
        <Link href="/external/portal" className="mb-3 inline-block text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text)]">← شغلاتي</Link>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold">{job.title}</h1>
            <div className="text-[12px] text-[var(--text-dim)]">Volt × {me.displayName ?? 'الشريك'} · موعد {dateAr(job.finalDueAt)}</div>
          </div>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: 'var(--surface2)', color: jobStatusTone(job.status) }}>{jobStatusLabel(job.status)}</span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h3 className="mb-2 text-[11px] uppercase tracking-wide text-[var(--text-dim)]">البريف</h3>
            <p className="text-[13px] text-[var(--text-muted)]">{job.brief || '—'}</p>
            <h3 className="mb-2 mt-3 text-[11px] uppercase tracking-wide text-[var(--text-dim)]">المادة الخام</h3>
            <div className="flex flex-wrap gap-2">
              {links.length === 0 && <span className="text-[12px] text-[var(--text-dim)]">—</span>}
              {links.map((m) => (
                <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]">🔗 {m.label || m.url}</a>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h2 className="mb-3 text-[15px] font-semibold">جولات المراجعة</h2>
            <div className="flex flex-col gap-3">
              {revisions.length === 0 && <span className="text-[12.5px] text-[var(--text-dim)]">لا ملاحظات بعد.</span>}
              {revisions.map((rv) => (
                <div key={rv.id} className="rounded-lg border border-[var(--line)] p-3">
                  <div className="flex items-center justify-between">
                    <b className="text-[13px]">جولة {rv.roundNumber} — ملاحظات فولت</b>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--surface2)', color: rv.status === 'approved' ? 'var(--success)' : 'var(--warning)' }}>
                      {rv.status === 'approved' ? 'معتمدة ✓' : rv.versionUrl ? 'بانتظار اعتمادهم' : 'بانتظار نسختك'}
                    </span>
                  </div>
                  {rv.changeRequest && <p className="mt-1.5 rounded bg-[var(--surface2)] px-2.5 py-1.5 text-[12.5px]">«{rv.changeRequest}»</p>}
                  <div className="mt-2">
                    {rv.versionUrl ? (
                      <a href={rv.versionUrl} target="_blank" rel="noreferrer" className="text-[12px] text-[var(--accent)]">▶ نسختك</a>
                    ) : rv.status !== 'approved' ? (
                      <form action={portalSubmitVersion.bind(null, job.id, rv.id)} className="flex gap-1.5">
                        <input name="version_url" required placeholder="الصق لينك نسختك (Frame.io / Drive)" className={field} />
                        <button className="rounded-lg bg-[var(--accent)] px-3 text-[12px] font-medium text-[#1a1a1a]">رفع</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h3 className="mb-2.5 text-[11px] uppercase tracking-wide text-[var(--text-dim)]">التسليم النهائي</h3>
            {job.finalId && finalUrl ? (
              <div>
                {job.finalMime?.startsWith('video/') ? (
                  <video src={finalUrl} controls className="mb-2.5 max-h-72 w-full rounded-lg bg-black" />
                ) : job.finalMime?.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={finalUrl} alt="الفاينل" className="mb-2.5 max-h-72 w-full rounded-lg object-contain" />
                ) : null}
                <div className="mb-2.5 flex items-center justify-between text-[12.5px]">
                  <span className="truncate text-[var(--text-muted)]">📦 {job.finalName}</span>
                  <a href={finalUrl} download className="rounded-lg border border-[var(--line-strong)] px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)]">⬇ تحميل</a>
                </div>
                <FinalUpload jobId={job.id} hasFinal mode="partner" />
              </div>
            ) : (
              <FinalUpload jobId={job.id} hasFinal={false} mode="partner" />
            )}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--text-dim)]">حسابك (لهذه الشغلة)</h3>
            <div className="flex justify-between border-b border-dashed border-[var(--line)] py-1.5 text-[13px]"><span className="text-[var(--text-muted)]">المتفق</span><span className="tabular-nums">{fmtSar(agreed)}</span></div>
            <div className="flex justify-between border-b border-dashed border-[var(--line)] py-1.5 text-[13px]"><span className="text-[var(--text-muted)]">المدفوع لك</span><span className="tabular-nums text-[var(--success)]">{fmtSar(paid)}</span></div>
            <div className="flex justify-between py-1.5 text-[13px]"><span className="text-[var(--text-muted)]">المتبقي لك</span><span className="tabular-nums text-[var(--warning)]">{fmtSar(agreed - paid)}</span></div>
          </div>
        </div>
      </main>
    </>
  );
}
