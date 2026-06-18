import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../auth';
import { addWaiting, resolveWaiting } from '../actions2';
import { todayRiyadh, dateAr } from '../data';

export const dynamic = 'force-dynamic';

interface W { id: string; what: string; who: string | null; since: string; followUpDate: string | null }

const field = 'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]';

export default async function WaitingPage() {
  const me = await requireOwner();
  const today = todayRiyadh();
  const items = (await db.execute(sql`
    SELECT id::text, what, who, since, follow_up_date AS "followUpDate"
    FROM me_waiting WHERE owner_id = ${me.profileId}::uuid AND resolved = false
    ORDER BY since
  `)) as unknown as W[];

  const ageDays = (since: string) => Math.max(0, Math.round((Date.parse(today) - Date.parse(since)) / 86400000));

  return (
    <div>
      <h1 className="mb-1 text-[22px] font-bold">المعلّق</h1>
      <p className="mb-4 text-[12px] text-[var(--text-dim)]">{items.length} مستني — متسيبش الخيط</p>

      <details className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
        <summary className="cursor-pointer text-[13px] font-medium text-[var(--accent)]">+ إضافة</summary>
        <form action={addWaiting} className="mt-3 flex flex-col gap-2.5">
          <input name="what" required placeholder="مستني إيه؟" className={field} />
          <div className="flex gap-2">
            <input name="who" placeholder="من مين؟" className={field} />
            <input type="date" name="follow_up_date" className={field} />
          </div>
          <button className="rounded-lg bg-[var(--accent)] py-2 text-[14px] font-medium text-[#1a1a1a]">إضافة</button>
        </form>
      </details>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-12 text-center text-[13px] text-[var(--text-dim)]">مفيش حاجة معلّقة ✨</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((w) => {
            const age = ageDays(w.since);
            return (
              <div key={w.id} className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px]">{w.what}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-dim)]">
                    {w.who && <span>👤 {w.who}</span>}
                    <span style={{ color: age >= 7 ? 'var(--danger)' : age >= 3 ? 'var(--warning)' : 'var(--text-dim)' }}>⏳ {age} يوم</span>
                    {w.followUpDate && <span>📅 متابعة {dateAr(w.followUpDate)}</span>}
                  </div>
                </div>
                <form action={resolveWaiting.bind(null, w.id)}>
                  <button className="shrink-0 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)]">✓ تم</button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
