import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../auth';
import { addRecurring, deleteRecurring } from '../actions2';

export const dynamic = 'force-dynamic';

const field = 'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]';
const CAD: Record<string, string> = { daily: 'يومي', weekdays: 'أيام العمل', weekly: 'أسبوعي' };

export default async function RecurringPage() {
  const me = await requireOwner();
  const items = (await db.execute(sql`
    SELECT id::text, title, cadence FROM me_recurring WHERE owner_id = ${me.profileId}::uuid AND active = true ORDER BY created_at
  `)) as unknown as Array<{ id: string; title: string; cadence: string }>;

  return (
    <div>
      <h1 className="mb-1 text-[22px] font-bold">المتكرر</h1>
      <p className="mb-4 text-[12px] text-[var(--text-dim)]">بيظهر تلقائياً في "النهارده"</p>

      <details className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
        <summary className="cursor-pointer text-[13px] font-medium text-[var(--accent)]">+ مهمة متكررة</summary>
        <form action={addRecurring} className="mt-3 flex flex-col gap-2.5">
          <input name="title" required placeholder="مثال: راجع المعلّق" className={field} />
          <select name="cadence" className={field}>
            <option value="daily">يومي</option>
            <option value="weekdays">أيام العمل (أحد–خميس)</option>
            <option value="weekly">أسبوعي</option>
          </select>
          <button className="rounded-lg bg-[var(--accent)] py-2 text-[14px] font-medium text-[#1a1a1a]">إضافة</button>
        </form>
      </details>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-12 text-center text-[13px] text-[var(--text-dim)]">لا مهام متكررة.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <div>
                <div className="text-[14px]">{r.title}</div>
                <div className="text-[11px] text-[var(--text-dim)]">♻️ {CAD[r.cadence] ?? r.cadence}</div>
              </div>
              <form action={deleteRecurring.bind(null, r.id)}><button className="text-[var(--text-dim)] hover:text-[var(--danger)]">×</button></form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
