import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  fmtSar, jobStatusLabel, jobStatusTone, checklist, isComplete, PAYMENT_METHODS,
} from '../data';
import {
  updateJob, addPayment, deletePayment, requestRevision, approveRevision,
  setRevisionVersion, addMaterialLink, removeMaterialLink, setJobStatus,
} from '../actions';
import { FinalUpload } from './FinalUpload';
import { requireVolt } from '../auth';
import { ManageHeader } from '../ManageHeader';
import { createInvite } from '../session-actions';

export const dynamic = 'force-dynamic';

const BUCKET = 'antagna-attachments';
const field =
  'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]';
const lbl = 'mb-1 block text-[11px] text-[var(--text-muted)]';

interface Job {
  id: string; code: string; title: string; status: string;
  scope: string | null; brief: string | null;
  partnerId: string | null; partnerName: string | null;
  projectCode: string | null;
  finalDueAt: string | null; deliveredAt: string | null; agreedAmountSar: string | null;
  finalId: string | null; finalPath: string | null; finalMime: string | null; finalName: string | null;
}
interface Payment { id: string; amountSar: string; method: string; paidAt: string; note: string | null }
interface Revision { id: string; roundNumber: number; changeRequest: string | null; versionUrl: string | null; status: string }
interface MatLink { id: string; provider: string; url: string; label: string | null }

const dateInput = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const dateAr = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireVolt();

  const jobs = (await db.execute(sql`
    SELECT j.id::text, j.code, j.title, j.status, j.scope, j.brief,
           j.partner_id::text AS "partnerId", p.name AS "partnerName",
           pr.code AS "projectCode",
           j.final_due_at AS "finalDueAt", j.delivered_at AS "deliveredAt",
           j.agreed_amount_sar AS "agreedAmountSar",
           a.id::text AS "finalId", a.storage_path AS "finalPath", a.mime_type AS "finalMime", a.filename AS "finalName"
    FROM external_jobs j
    LEFT JOIN partners p ON p.id = j.partner_id
    LEFT JOIN projects pr ON pr.id = j.project_id
    LEFT JOIN attachments a ON a.id = j.final_attachment_id
    WHERE j.id = ${id}::uuid
  `)) as unknown as Job[];
  const job = jobs[0];
  if (!job) notFound();

  const [payments, revisions, links, partners] = (await Promise.all([
    db.execute(sql`SELECT id::text, amount_sar AS "amountSar", method, paid_at AS "paidAt", note FROM external_payments WHERE job_id = ${id}::uuid ORDER BY paid_at, created_at`),
    db.execute(sql`SELECT id::text, round_number AS "roundNumber", change_request AS "changeRequest", version_url AS "versionUrl", status FROM external_job_revisions WHERE job_id = ${id}::uuid ORDER BY round_number`),
    db.execute(sql`SELECT id::text, provider, url, label FROM external_links WHERE entity_type='external_job' AND entity_id = ${id}::uuid ORDER BY created_at`),
    db.execute(sql`SELECT id::text, name, kind FROM partners WHERE active ORDER BY name`),
  ])) as unknown as [Payment[], Revision[], MatLink[], Array<{ id: string; name: string; kind: string }>];

  const paid = payments.reduce((s, p) => s + Number(p.amountSar), 0);
  const agreed = Number(job.agreedAmountSar ?? 0);
  const remaining = agreed - paid;
  const cl = checklist({
    brief: job.brief, scope: job.scope, partnerId: job.partnerId,
    finalDueAt: job.finalDueAt, agreedAmountSar: job.agreedAmountSar, materialCount: links.length,
  });
  const complete = isComplete({
    brief: job.brief, scope: job.scope, partnerId: job.partnerId,
    finalDueAt: job.finalDueAt, agreedAmountSar: job.agreedAmountSar, materialCount: links.length,
  });

  // Signed URL for the uploaded final (preview + download).
  let finalUrl: string | null = null;
  if (job.finalPath) {
    try {
      const { data } = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrl(job.finalPath, 3600);
      finalUrl = data?.signedUrl ?? null;
    } catch { /* ignore */ }
  }

  // Partner account / pending-invite state (drives "ادعُ الشريك").
  let inviteToken: string | null = null;
  let partnerHasAccount = false;
  if (job.partnerId) {
    const st = (await db.execute(sql`
      SELECT
        (SELECT token::text FROM partner_invites WHERE partner_id = ${job.partnerId}::uuid AND accepted_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1) AS "token",
        EXISTS(SELECT 1 FROM ext_users WHERE partner_id = ${job.partnerId}::uuid AND role='partner') AS "hasAccount"
    `)) as unknown as Array<{ token: string | null; hasAccount: boolean }>;
    inviteToken = st[0]?.token ?? null;
    partnerHasAccount = st[0]?.hasAccount ?? false;
  }

  return (
    <>
      <ManageHeader name={me.displayName} />
      <main className="mx-auto max-w-5xl px-5 py-7">
    <div>
      <Link href="/external" className="mb-3 inline-block text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text)]">← رجوع للقائمة</Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] text-[var(--text-dim)]">
            {job.code}{job.projectCode && <> · ↳ {job.projectCode}</>}
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[20px] font-semibold">{job.title}</h1>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: 'var(--surface2)', color: jobStatusTone(job.status) }}>
              {jobStatusLabel(job.status)}
            </span>
          </div>
          <div className="mt-1 text-[12px] text-[var(--text-dim)]">الشريك: {job.partnerName ?? '—'}</div>
        </div>
        <div className="flex gap-1.5">
          {job.status === 'draft' && (
            <form action={setJobStatus.bind(null, job.id, 'in_progress')}>
              <button className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-[#1a1a1a]">بدء التنفيذ</button>
            </form>
          )}
          {job.partnerId && !partnerHasAccount && complete && (
            <form action={createInvite.bind(null, job.id)}>
              <button className="rounded-lg border border-[var(--line-strong)] px-3 py-1.5 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]">🔗 ادعُ الشريك</button>
            </form>
          )}
          {partnerHasAccount && <span className="self-center rounded-lg bg-[var(--success)]/10 px-2.5 py-1.5 text-[11px] text-[var(--success)]">✓ للشريك حساب</span>}
        </div>
      </div>

      {!complete && (
        <div className="mb-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3.5 py-2.5 text-[12.5px]">
          ⚠ بيانات ناقصة — أكمل: {cl.filter((c) => !c.ok).map((c) => c.label).join('، ')} قبل إرسالها للشريك.
        </div>
      )}

      {inviteToken && !partnerHasAccount && (
        <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-[12.5px]">
          ✉ رابط دعوة الشريك (يُرسل بالإيميل في المرحلة ٣ — انسخه الآن):
          <code className="mt-1 block break-all rounded bg-[var(--bg)] px-2 py-1 text-[11px] text-[var(--accent)]">/external/invite/{inviteToken}</code>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
        {/* LEFT */}
        <div className="flex flex-col gap-4">
          {/* edit core */}
          <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4" open={!complete}>
            <summary className="cursor-pointer text-[13px] font-semibold">السكوب + البريف + البيانات</summary>
            <form action={updateJob.bind(null, job.id)} className="mt-3 flex flex-col gap-3">
              <div><label className={lbl}>العنوان</label><input name="title" defaultValue={job.title} className={field} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>الشريك</label>
                  <select name="partner_id" defaultValue={job.partnerId ?? ''} className={field}>
                    <option value="">— لاحقاً —</option>
                    {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>موعد الفاينل</label><input type="date" name="final_due_at" defaultValue={dateInput(job.finalDueAt)} className={field} /></div>
              </div>
              <div><label className={lbl}>السكوب</label><textarea name="scope" rows={2} defaultValue={job.scope ?? ''} className={field} /></div>
              <div><label className={lbl}>البريف</label><textarea name="brief" rows={4} defaultValue={job.brief ?? ''} className={field} /></div>
              <div><label className={lbl}>المبلغ المتفق (ر.س)</label><input name="agreed_amount_sar" defaultValue={job.agreedAmountSar ?? ''} className={field} /></div>
              <button className="self-start rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[#1a1a1a]">حفظ</button>
            </form>
          </details>

          {/* material links */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h3 className="mb-2.5 text-[11px] uppercase tracking-wide text-[var(--text-dim)]">لينكات المادة الخام</h3>
            <div className="mb-3 flex flex-col gap-1.5">
              {links.length === 0 && <span className="text-[12px] text-[var(--text-dim)]">لا لينكات بعد.</span>}
              {links.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12.5px]">
                  <a href={m.url} target="_blank" rel="noreferrer" className="truncate text-[var(--text-muted)] hover:text-[var(--accent)]">
                    🔗 {m.label || m.url} <span className="text-[10px] text-[var(--text-dim)]">· {m.provider}</span>
                  </a>
                  <form action={removeMaterialLink.bind(null, job.id, m.id)}><button className="text-[var(--text-dim)] hover:text-[var(--danger)]">×</button></form>
                </div>
              ))}
            </div>
            <form action={addMaterialLink.bind(null, job.id)} className="flex gap-2">
              <select name="provider" className={field + ' max-w-[110px]'}>
                <option value="gdrive">Drive</option><option value="frameio">Frame.io</option>
                <option value="youtube">YouTube</option><option value="other">أخرى</option>
              </select>
              <input name="url" required placeholder="الرابط" className={field} />
              <input name="label" placeholder="وصف" className={field + ' max-w-[120px]'} />
              <button className="rounded-lg border border-[var(--line-strong)] px-3 text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text)]">+</button>
            </form>
          </div>

          {/* revisions */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h2 className="mb-3 text-[15px] font-semibold">جولات المراجعة</h2>
            <div className="flex flex-col gap-3">
              {revisions.length === 0 && <span className="text-[12.5px] text-[var(--text-dim)]">لا جولات بعد.</span>}
              {revisions.map((rv) => (
                <div key={rv.id} className="rounded-lg border border-[var(--line)] p-3">
                  <div className="flex items-center justify-between">
                    <b className="text-[13px]">جولة {rv.roundNumber}</b>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--surface2)', color: rv.status === 'approved' ? 'var(--success)' : 'var(--warning)' }}>
                      {rv.status === 'approved' ? 'معتمدة' : rv.versionUrl ? 'بانتظار الاعتماد' : 'بانتظار نسخة الشريك'}
                    </span>
                  </div>
                  {rv.changeRequest && <p className="mt-1.5 rounded bg-[var(--surface2)] px-2.5 py-1.5 text-[12.5px]">«{rv.changeRequest}»</p>}
                  <div className="mt-2 flex items-center gap-2">
                    {rv.versionUrl ? (
                      <a href={rv.versionUrl} target="_blank" rel="noreferrer" className="text-[12px] text-[var(--accent)]">▶ نسخة الشريك</a>
                    ) : (
                      <form action={setRevisionVersion.bind(null, job.id, rv.id)} className="flex gap-1.5">
                        <input name="version_url" placeholder="لصق لينك نسخة الشريك" className={field + ' py-1 text-[12px]'} />
                        <button className="rounded border border-[var(--line-strong)] px-2 text-[11px] text-[var(--text-muted)]">حفظ</button>
                      </form>
                    )}
                    {rv.versionUrl && rv.status !== 'approved' && (
                      <form action={approveRevision.bind(null, job.id, rv.id)}>
                        <button className="rounded bg-[var(--accent)] px-2.5 py-1 text-[11px] font-medium text-[#1a1a1a]">اعتماد</button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <form action={requestRevision.bind(null, job.id)} className="mt-3 flex gap-2">
              <input name="change_request" required placeholder="اكتب ملاحظات تعديل جديدة للشريك…" className={field} />
              <button className="rounded-lg border border-[var(--line-strong)] px-3 text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text)]">+ طلب تعديل</button>
            </form>
          </div>

          {/* final */}
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
                <FinalUpload jobId={job.id} hasFinal />
              </div>
            ) : (
              <FinalUpload jobId={job.id} hasFinal={false} />
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h3 className="mb-2.5 text-[11px] uppercase tracking-wide text-[var(--text-dim)]">المواعيد</h3>
            <div className="flex justify-between py-1 text-[12.5px]"><span className="text-[var(--text-muted)]">الفاينل</span><b>{dateAr(job.finalDueAt)}</b></div>
            <div className="flex justify-between py-1 text-[12.5px]"><span className="text-[var(--text-muted)]">سُلّم</span><span>{dateAr(job.deliveredAt)}</span></div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h3 className="mb-1 text-[11px] uppercase tracking-wide text-[var(--text-dim)]">الحسابات</h3>
            <div className="text-[22px] font-bold tabular-nums">{fmtSar(remaining)} <span className="text-[13px] font-normal text-[var(--text-dim)]">ر.س متبقي</span></div>
            <div className="my-2 h-1.5 overflow-hidden rounded bg-[var(--surface2)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${agreed > 0 ? Math.min(100, Math.round((paid / agreed) * 100)) : 0}%` }} /></div>
            <div className="flex justify-between border-b border-dashed border-[var(--line)] py-1.5 text-[12.5px]"><span className="text-[var(--text-muted)]">المتفق</span><span className="tabular-nums">{fmtSar(agreed)}</span></div>
            <div className="flex justify-between border-b border-dashed border-[var(--line)] py-1.5 text-[12.5px]"><span className="text-[var(--text-muted)]">المدفوع</span><span className="tabular-nums text-[var(--success)]">{fmtSar(paid)}</span></div>
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-dashed border-[var(--line)] py-1.5 text-[12px]">
                <span className="text-[var(--text-dim)]">{p.note || PAYMENT_METHODS.find((m) => m.value === p.method)?.label}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{fmtSar(Number(p.amountSar))} · {dateAr(p.paidAt)}</span>
                  <form action={deletePayment.bind(null, job.id, p.id)}><button className="text-[var(--text-dim)] hover:text-[var(--danger)]">×</button></form>
                </span>
              </div>
            ))}
            <form action={addPayment.bind(null, job.id)} className="mt-2.5 flex flex-col gap-2">
              <div className="flex gap-2">
                <input name="amount_sar" inputMode="numeric" placeholder="مبلغ" required className={field} />
                <select name="method" className={field + ' max-w-[100px]'}>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
              </div>
              <input name="note" placeholder="ملاحظة (اختياري)" className={field} />
              <button className="rounded-lg border border-[var(--line-strong)] py-1.5 text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text)]">+ تسجيل دفعة</button>
            </form>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--text-dim)]">اكتمال البيانات</h3>
            {cl.map((c) => (
              <div key={c.key} className="flex items-center gap-2 py-1 text-[12.5px]">
                <span style={{ color: c.ok ? 'var(--success)' : 'var(--warning)' }}>{c.ok ? '✓' : '○'}</span> {c.label}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[12px] leading-relaxed text-[var(--text-muted)]">
            <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--text-dim)]">تنبيهات الإيميل</h3>
            <span className="text-[var(--accent)]">✉ للشريك</span> بريف · طلب تعديل · تذكير موعد<br />
            <span className="text-[var(--accent)]">✉ لفولت</span> رفع نسخة · تسليم · اقتراب موعد
            <p className="mt-1.5 text-[10px] text-[var(--text-dim)]">(تُفعّل في المرحلة ٣)</p>
          </div>
        </div>
      </div>
    </div>
      </main>
    </>
  );
}
