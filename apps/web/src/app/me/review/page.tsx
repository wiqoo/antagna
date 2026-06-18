import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../auth';
import { buildWeeklySummary } from '../ai';
import { saveWeeklyReview } from '../actions2';
import { todayRiyadh } from '../data';

export const dynamic = 'force-dynamic';

const field = 'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]';

export default async function ReviewPage() {
  const me = await requireOwner();
  const today = todayRiyadh();
  const { stats, ai } = await buildWeeklySummary(me.profileId);

  const prev = (await db.execute(sql`
    SELECT content FROM me_reviews WHERE owner_id = ${me.profileId}::uuid AND type='weekly' AND review_date = ${today}::date
  `)) as unknown as Array<{ content: { done?: string; stalled?: string; lesson?: string; next?: string } }>;
  const c = prev[0]?.content ?? {};

  return (
    <div>
      <h1 className="mb-1 text-[22px] font-bold">المراجعة الأسبوعية</h1>
      <p className="mb-4 text-[12px] text-[var(--text-dim)]">حجر الزاوية — ٢٠ دقيقة تخلّي السيستم موثوق</p>

      <div className="mb-4 grid grid-cols-4 gap-2">
        <Mini label="خلّصت" value={stats.doneThisWeek} />
        <Mini label="مفتوح" value={stats.openTasks} />
        <Mini label="متأخر" value={stats.overdue} tone={stats.overdue ? 'var(--warning)' : undefined} />
        <Mini label="معلّق" value={stats.waiting} />
      </div>

      {ai && (
        <div className="mb-5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3.5 text-[13px] leading-relaxed">
          <p className="mb-1 text-[12px] text-[var(--accent)]">✨ ملخص الأسبوع</p>
          <p className="whitespace-pre-wrap">{ai}</p>
        </div>
      )}

      <form action={saveWeeklyReview} className="flex flex-col gap-3">
        <Q name="done" label="عملت إيه الأسبوع ده؟" def={c.done} />
        <Q name="stalled" label="إيه اللي اتعطّل وليه؟" def={c.stalled} />
        <Q name="lesson" label="درس / تعلّمت إيه؟" def={c.lesson} />
        <Q name="next" label="تركيز الأسبوع الجاي؟" def={c.next} />
        <button className="rounded-xl bg-[var(--accent)] py-3 text-[15px] font-semibold text-[#1a1a1a]">حفظ المراجعة</button>
      </form>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-center">
      <div className="text-[18px] font-bold" style={{ color: tone }}>{value}</div>
      <div className="text-[10px] text-[var(--text-dim)]">{label}</div>
    </div>
  );
}
function Q({ name, label, def }: { name: string; label: string; def?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] text-[var(--text-muted)]">{label}</label>
      <textarea name={name} rows={2} defaultValue={def ?? ''} className={field} />
    </div>
  );
}
