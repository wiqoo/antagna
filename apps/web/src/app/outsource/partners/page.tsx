import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { createPartner } from '../actions';
import { PARTNER_KINDS, SPECIALTIES, SPECIALTY_LABEL } from '../data';
import { requireVolt } from '../auth';
import { ManageHeader } from '../ManageHeader';

export const dynamic = 'force-dynamic';

const field =
  'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]';
const label = 'mb-1.5 block text-[11px] text-[var(--text-muted)]';

interface PartnerRow {
  id: string; name: string; kind: string; specialties: string[];
  contactName: string | null; contactEmail: string | null; jobCount: number;
}

export default async function PartnersPage() {
  await requireVolt();
  const partners = (await db.execute(sql`
    SELECT p.id::text, p.name, p.kind, p.specialties,
           p.contact_name AS "contactName", p.contact_email AS "contactEmail",
           (SELECT COUNT(*)::int FROM external_jobs j WHERE j.partner_id = p.id) AS "jobCount"
    FROM partners p WHERE p.active ORDER BY p.created_at DESC
  `)) as unknown as PartnerRow[];

  return (
    <>
      <ManageHeader />
      <main className="mx-auto max-w-5xl px-5 py-7">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
      <div>
        <h1 className="mb-4 text-[20px] font-semibold">الشركاء</h1>
        {partners.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] py-14 text-center text-[var(--text-dim)]">
            لا شركاء بعد — أضف أول شريك ←
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {partners.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium">{p.name}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-dim)]" style={{ background: 'var(--surface2)' }}>
                      {p.kind === 'individual' ? 'فريلانسر' : 'شركة'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                    {(p.specialties ?? []).map((s) => SPECIALTY_LABEL[s] ?? s).join(' · ') || '—'}
                    {p.contactEmail && <span> · {p.contactEmail}</span>}
                  </div>
                </div>
                <span className="text-[11px] text-[var(--text-dim)]">{p.jobCount} مشروع</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <form action={createPartner} className="flex h-fit flex-col gap-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-[14px] font-semibold">إضافة شريك</h2>
        <div>
          <label className={label}>الاسم *</label>
          <input name="name" required className={field} placeholder="اسم الشركة / الفريلانسر" />
        </div>
        <div>
          <label className={label}>النوع</label>
          <select name="kind" className={field}>
            {PARTNER_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>التخصصات</label>
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map((s) => (
              <label key={s.value} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 py-1 text-[12px] text-[var(--text-muted)]">
                <input type="checkbox" name="specialties" value={s.value} className="accent-[var(--accent)]" />
                {s.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={label}>جهة الاتصال</label>
          <input name="contact_name" className={field} placeholder="الاسم" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="contact_email" className={field} placeholder="الإيميل" />
          <input name="contact_phone" className={field} placeholder="الجوال" />
        </div>
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[#1a1a1a] hover:bg-[var(--accent-hover)]">
          + إضافة شريك
        </button>
      </form>
      </div>
      </main>
    </>
  );
}
