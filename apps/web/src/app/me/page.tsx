import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from './auth';
import { createTask, toggleTask, setTaskToday } from './actions';
import { toggleHabitToday } from './actions2';
import { ensureTodayRecurring } from './lib';
import { PRIORITY_TONE, todayRiyadh, dateAr } from './data';

export const dynamic = 'force-dynamic';

interface Task {
  id: string; title: string; priority: string; status: string;
  isToday: boolean; dueDate: string | null; context: string | null; projectTitle: string | null;
}

export default async function TodayPage() {
  const me = await requireOwner();
  const today = todayRiyadh();
  await ensureTodayRecurring(me.profileId);

  // habits for the quick-check strip
  const habits = (await db.execute(sql`
    SELECT h.id::text, h.title, EXISTS(SELECT 1 FROM me_habit_logs l WHERE l.habit_id=h.id AND l.log_date=${today}::date) AS done
    FROM me_habits h WHERE h.owner_id=${me.profileId}::uuid AND h.active=true ORDER BY h.created_at
  `)) as unknown as Array<{ id: string; title: string; done: boolean }>;

  // optional pull from Antagna (his own work) — best-effort, never breaks the page
  let antagna: Array<{ title: string; proj: string | null; pid: string; dueAt: string | null }> = [];
  try {
    antagna = (await db.execute(sql`
      SELECT pt.title, COALESCE(p.title_ar, p.title) AS proj, pt.project_id::text AS pid, pt.due_at AS "dueAt"
      FROM project_tasks pt JOIN projects p ON p.id = pt.project_id
      WHERE pt.assignee_id = ${me.profileId}::uuid
        AND pt.status IN ('pending','in_progress','blocked')
        AND pt.due_at IS NOT NULL AND (pt.due_at AT TIME ZONE 'Asia/Riyadh')::date <= ${today}::date
      ORDER BY pt.due_at LIMIT 20
    `)) as unknown as typeof antagna;
  } catch {
    antagna = [];
  }

  const tasks = (await db.execute(sql`
    SELECT t.id::text, t.title, t.priority, t.status, t.is_today AS "isToday",
           t.due_date AS "dueDate", t.context, p.title AS "projectTitle"
    FROM me_tasks t LEFT JOIN me_projects p ON p.id = t.project_id
    WHERE t.owner_id = ${me.profileId}::uuid AND t.status <> 'done'
      AND (t.is_today = true OR (t.due_date IS NOT NULL AND t.due_date <= ${today}::date))
    ORDER BY (t.due_date < ${today}::date) DESC, t.priority = 'high' DESC, t.due_date NULLS LAST
  `)) as unknown as Task[];

  const counts = (await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM me_inbox WHERE owner_id = ${me.profileId}::uuid AND processed = false) AS "inbox",
      (SELECT count(*)::int FROM me_tasks WHERE owner_id = ${me.profileId}::uuid AND status = 'done' AND completed_at::date = ${today}::date) AS "doneToday"
  `)) as unknown as Array<{ inbox: number; doneToday: number }>;
  const { inbox = 0, doneToday = 0 } = counts[0] ?? {};

  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today);
  const todays = tasks.filter((t) => !(t.dueDate && t.dueDate < today));

  const dayLabel = new Date().toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });

  const row = (t: Task, overdueRow = false) => (
    <div key={t.id} className="flex items-start gap-3 border-b border-[var(--line)] py-3 last:border-0">
      <form action={toggleTask.bind(null, t.id)}>
        <button className="mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-[var(--line-bold)] text-[11px] text-transparent hover:border-[var(--accent)]">✓</button>
      </form>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug">{t.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-dim)]">
          <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_TONE[t.priority] }} />
          {t.projectTitle && <span>📁 {t.projectTitle}</span>}
          {t.context && <span>{t.context}</span>}
          {t.dueDate && <span style={{ color: overdueRow ? 'var(--danger)' : 'var(--text-dim)' }}>📅 {dateAr(t.dueDate)}</span>}
        </div>
      </div>
      {!t.isToday && (
        <form action={setTaskToday.bind(null, t.id, true)}>
          <button className="shrink-0 rounded-lg border border-[var(--line)] px-2 py-1 text-[10px] text-[var(--text-dim)]">+ النهارده</button>
        </form>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[22px] font-bold">{me.displayName?.split(' ')[0] ?? 'أهلاً'} 👋</h1>
        <p className="text-[12px] text-[var(--text-dim)]">{dayLabel} · خلّصت {doneToday} النهارده</p>
      </div>

      {inbox > 0 && (
        <Link href="/me/inbox" className="mb-4 flex items-center justify-between rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3.5 py-2.5 text-[13px]">
          <span>📥 عندك {inbox} في الوارد محتاجة ترتيب</span>
          <span className="text-[var(--accent)]">رتّبها ←</span>
        </Link>
      )}

      {habits.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {habits.map((h) => (
            <form key={h.id} action={toggleHabitToday.bind(null, h.id, today)}>
              <button className="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px]" style={{ borderColor: h.done ? 'transparent' : 'var(--line)', background: h.done ? 'var(--accent)' : 'transparent', color: h.done ? '#1a1a1a' : 'var(--text-muted)' }}>
                {h.done ? '✓' : '○'} {h.title}
              </button>
            </form>
          ))}
        </div>
      )}

      <form action={createTask} className="mb-4 flex gap-2">
        <input type="hidden" name="is_today" value="1" />
        <input name="title" required placeholder="أضف مهمة للنهارده…" className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--accent)]" />
        <button className="rounded-xl bg-[var(--accent)] px-4 text-[18px] font-light text-[#1a1a1a]">+</button>
      </form>

      {overdue.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-1 text-[12px] font-semibold text-[var(--danger)]">متأخر ({overdue.length})</h2>
          {overdue.map((t) => row(t, true))}
        </section>
      )}

      <section>
        <h2 className="mb-1 text-[12px] font-semibold text-[var(--text-muted)]">النهارده ({todays.length})</h2>
        {todays.length === 0 && overdue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] py-12 text-center text-[13px] text-[var(--text-dim)]">
            مفيش حاجة للنهارده ✨<br />ارمي أفكارك في الوارد أو أضف مهمة فوق.
          </div>
        ) : todays.map((t) => row(t))}
      </section>

      {antagna.length > 0 && (
        <details className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-[var(--text-muted)]">🔗 من انتجنا ({antagna.length})</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {antagna.map((a, i) => (
              <a key={i} href={`/projects/${a.pid}`} className="flex items-center justify-between border-b border-[var(--line)] py-1.5 text-[13px] last:border-0">
                <span className="min-w-0 flex-1">{a.title}{a.proj && <span className="text-[11px] text-[var(--text-dim)]"> · {a.proj}</span>}</span>
                <span className="text-[10px] text-[var(--text-dim)]">{a.dueAt ? dateAr(a.dueAt) : ''}</span>
              </a>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-[var(--text-dim)]">شغلك في انتجنا المستحق — للعرض فقط.</p>
        </details>
      )}
    </div>
  );
}
