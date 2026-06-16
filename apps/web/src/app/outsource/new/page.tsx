import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { createJob } from '../actions';
import { requireVolt } from '../auth';
import { ManageHeader } from '../ManageHeader';

export const dynamic = 'force-dynamic';

const field =
  'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]';
const label = 'mb-1.5 block text-[11px] text-[var(--text-muted)]';

export default async function NewJobPage() {
  await requireVolt();
  const partners = (await db.execute<{ id: string; name: string; kind: string }>(sql`
    SELECT id::text, name, kind FROM partners WHERE active ORDER BY name
  `)) as unknown as Array<{ id: string; name: string; kind: string }>;

  return (
    <>
      <ManageHeader />
      <main className="px-5 py-7">
      <div className="mx-auto max-w-2xl">
      <Link href="/outsource" className="mb-3 inline-block text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text)]">← رجوع</Link>
      <h1 className="mb-5 text-[20px] font-semibold">مشروع خارجي جديد</h1>

      <form action={createJob} className="flex flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div>
          <label className={label}>عنوان المشروع *</label>
          <input name="title" required className={field} placeholder="مثال: BMW X5 — مونتاج الإطلاق" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>الشريك</label>
            <select name="partner_id" className={field} defaultValue="">
              <option value="">— لاحقاً —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.kind === 'individual' ? '(فريلانسر)' : '(شركة)'}</option>
              ))}
            </select>
            {partners.length === 0 && (
              <p className="mt-1 text-[11px] text-[var(--text-dim)]">لا شركاء بعد — <Link href="/outsource/partners" className="text-[var(--accent)]">أضف شريك</Link></p>
            )}
          </div>
          <div>
            <label className={label}>موعد الفاينل</label>
            <input type="date" name="final_due_at" className={field} />
          </div>
        </div>

        <div>
          <label className={label}>السكوب</label>
          <textarea name="scope" rows={2} className={field} placeholder="نطاق العمل المطلوب…" />
        </div>
        <div>
          <label className={label}>البريف</label>
          <textarea name="brief" rows={4} className={field} placeholder="تفاصيل البريف…" />
        </div>
        <div>
          <label className={label}>المبلغ المتفق (ر.س)</label>
          <input name="agreed_amount_sar" inputMode="numeric" className={field} placeholder="8000" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Link href="/outsource" className="rounded-lg border border-[var(--line-strong)] px-4 py-2 text-[13px] text-[var(--text-muted)]">إلغاء</Link>
          <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[#1a1a1a] hover:bg-[var(--accent-hover)]">إنشاء المشروع</button>
        </div>
      </form>
      </div>
      </main>
    </>
  );
}
