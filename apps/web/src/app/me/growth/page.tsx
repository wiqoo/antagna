import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../auth';
import { addHabit, toggleHabitToday, deleteHabit, addGoal, setGoalProgress } from '../actions2';
import { todayRiyadh, STAGE_LABEL } from '../data';

export const dynamic = 'force-dynamic';

const field = 'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]';

function streak(dates: Set<string>, today: string): number {
  let s = 0;
  const d = new Date(today + 'T00:00:00');
  // allow today not yet done: start from today; if today missing, start yesterday
  if (!dates.has(today)) d.setDate(d.getDate() - 1);
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (dates.has(key)) { s++; d.setDate(d.getDate() - 1); } else break;
  }
  return s;
}

export default async function GrowthPage() {
  const me = await requireOwner();
  const today = todayRiyadh();

  const [habits, logs, goals, stats, stages] = (await Promise.all([
    db.execute(sql`SELECT id::text, title FROM me_habits WHERE owner_id=${me.profileId}::uuid AND active=true ORDER BY created_at`),
    db.execute(sql`SELECT habit_id::text AS "habitId", log_date::text AS "logDate" FROM me_habit_logs WHERE owner_id=${me.profileId}::uuid AND log_date >= now() - interval '70 days'`),
    db.execute(sql`SELECT id::text, title, type, progress, target_date AS "targetDate" FROM me_goals WHERE owner_id=${me.profileId}::uuid AND status='active' ORDER BY created_at`),
    db.execute(sql`SELECT
        (SELECT count(*)::int FROM me_tasks WHERE owner_id=${me.profileId}::uuid AND status='done' AND completed_at >= now()-interval '7 days') AS w,
        (SELECT count(*)::int FROM me_tasks WHERE owner_id=${me.profileId}::uuid AND status='done' AND completed_at >= now()-interval '30 days') AS m,
        (SELECT count(*)::int FROM me_tasks WHERE owner_id=${me.profileId}::uuid AND status<>'done') AS open,
        (SELECT count(*)::int FROM me_tasks WHERE owner_id=${me.profileId}::uuid AND status<>'done' AND due_date < ${today}::date) AS overdue,
        (SELECT COALESCE(SUM(minutes),0)::int FROM me_time_logs WHERE owner_id=${me.profileId}::uuid AND log_date >= now()-interval '7 days') AS mins`),
    db.execute(sql`SELECT stage, count(*)::int AS n FROM me_projects WHERE owner_id=${me.profileId}::uuid AND type='work' AND status='active' AND stage IS NOT NULL GROUP BY stage ORDER BY n DESC`),
  ])) as unknown as [
    Array<{ id: string; title: string }>,
    Array<{ habitId: string; logDate: string }>,
    Array<{ id: string; title: string; type: string; progress: number; targetDate: string | null }>,
    Array<{ w: number; m: number; open: number; overdue: number; mins: number }>,
    Array<{ stage: string; n: number }>,
  ];

  const logsByHabit = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!logsByHabit.has(l.habitId)) logsByHabit.set(l.habitId, new Set());
    logsByHabit.get(l.habitId)!.add(l.logDate);
  }
  const st = stats[0] ?? { w: 0, m: 0, open: 0, overdue: 0, mins: 0 };
  const completion = st.m + st.open > 0 ? Math.round((st.m / (st.m + st.open)) * 100) : 0;
  const bottleneck = stages[0];

  return (
    <div>
      <h1 className="mb-4 text-[22px] font-bold">التطوّر</h1>

      {/* analytics */}
      <section className="mb-6">
        <h2 className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">📈 تحليلاتك</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="خلّصت (٧ أيام)" value={`${st.w}`} />
          <Stat label="خلّصت (٣٠ يوم)" value={`${st.m}`} />
          <Stat label="معدل الإنجاز" value={`${completion}%`} />
          <Stat label="متأخر" value={`${st.overdue}`} tone={st.overdue > 0 ? 'var(--warning)' : undefined} />
          {st.mins > 0 && <Stat label="وقت مسجّل (٧ أيام)" value={`${Math.round(st.mins / 60)} س`} />}
          {bottleneck && <Stat label="عنق الزجاجة" value={STAGE_LABEL[bottleneck.stage] ?? bottleneck.stage} small />}
        </div>
      </section>

      {/* habits */}
      <section className="mb-6">
        <h2 className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">🔥 العادات</h2>
        <div className="flex flex-col gap-2">
          {habits.map((h) => {
            const set = logsByHabit.get(h.id) ?? new Set<string>();
            const done = set.has(today);
            const s = streak(set, today);
            return (
              <div key={h.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
                <form action={toggleHabitToday.bind(null, h.id, today)}>
                  <button className="grid h-7 w-7 place-items-center rounded-full text-[14px]" style={{ background: done ? 'var(--accent)' : 'var(--surface2)', color: done ? '#1a1a1a' : 'var(--text-dim)' }}>✓</button>
                </form>
                <span className="flex-1 text-[14px]">{h.title}</span>
                {s > 0 && <span className="text-[12px] text-[var(--accent)]">🔥 {s}</span>}
                <form action={deleteHabit.bind(null, h.id)}><button className="text-[var(--text-dim)] hover:text-[var(--danger)]">×</button></form>
              </div>
            );
          })}
        </div>
        <details className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"><summary className="cursor-pointer text-[12px] text-[var(--accent)]">+ عادة</summary>
          <form action={addHabit} className="mt-2 flex gap-2"><input name="title" required placeholder="مثال: راجع المعلّق كل يوم" className={field} /><button className="rounded-lg bg-[var(--accent)] px-4 text-[18px] font-light text-[#1a1a1a]">+</button></form>
        </details>
      </section>

      {/* goals */}
      <section>
        <h2 className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">🎯 الأهداف</h2>
        <div className="flex flex-col gap-2.5">
          {goals.map((g) => (
            <div key={g.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium">{g.title}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-dim)]" style={{ background: 'var(--surface2)' }}>{g.type === 'career' ? 'مهني' : 'شخصي'}</span>
              </div>
              <div className="my-2 h-1.5 overflow-hidden rounded bg-[var(--surface2)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${g.progress}%` }} /></div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-dim)]">{g.progress}%</span>
                <div className="flex gap-1.5">
                  <form action={setGoalProgress.bind(null, g.id, Math.max(0, g.progress - 25))}><button className="rounded border border-[var(--line)] px-2 py-0.5 text-[12px]">−</button></form>
                  <form action={setGoalProgress.bind(null, g.id, Math.min(100, g.progress + 25))}><button className="rounded border border-[var(--line)] px-2 py-0.5 text-[12px]">+</button></form>
                </div>
              </div>
            </div>
          ))}
        </div>
        <details className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"><summary className="cursor-pointer text-[12px] text-[var(--accent)]">+ هدف</summary>
          <form action={addGoal} className="mt-2 flex flex-col gap-2">
            <input name="title" required placeholder="الهدف" className={field} />
            <div className="flex gap-2">
              <select name="type" className={field}><option value="personal">شخصي</option><option value="career">مهني</option></select>
              <input type="date" name="target_date" className={field} />
            </div>
            <button className="rounded-lg bg-[var(--accent)] py-2 text-[14px] font-medium text-[#1a1a1a]">إضافة</button>
          </form>
        </details>
      </section>
    </div>
  );
}

function Stat({ label, value, tone, small }: { label: string; value: string; tone?: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="text-[10px] text-[var(--text-dim)]">{label}</div>
      <div className={small ? 'text-[14px] font-semibold' : 'text-[20px] font-bold'} style={{ color: tone }}>{value}</div>
    </div>
  );
}
