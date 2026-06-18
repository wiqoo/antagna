import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../../auth';
import { createTask, toggleTask, deleteTask, updateProject } from '../../actions';
import { STAGES, PRIORITY_TONE, dateAr } from '../../data';

export const dynamic = 'force-dynamic';

const field = 'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]';
const lbl = 'mb-1 block text-[11px] text-[var(--text-muted)]';

interface Proj { id: string; title: string; type: string; stage: string | null; status: string; deadline: string | null; notes: string | null }
interface Task { id: string; title: string; priority: string; status: string; dueDate: string | null; context: string | null }

const di = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default async function MeProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireOwner();

  const rows = (await db.execute(sql`
    SELECT id::text, title, type, stage, status, deadline, notes
    FROM me_projects WHERE id = ${id}::uuid AND owner_id = ${me.profileId}::uuid
  `)) as unknown as Proj[];
  const p = rows[0];
  if (!p) notFound();

  const tasks = (await db.execute(sql`
    SELECT id::text, title, priority, status, due_date AS "dueDate", context
    FROM me_tasks WHERE project_id = ${id}::uuid AND owner_id = ${me.profileId}::uuid
    ORDER BY status = 'done', position, created_at
  `)) as unknown as Task[];
  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <div>
      <Link href="/me/projects" className="mb-2 inline-block text-[12.5px] text-[var(--text-muted)]">← المشاريع</Link>
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-[20px] font-bold">{p.title}</h1>
        <span className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-dim)]" style={{ background: 'var(--surface2)' }}>{p.type === 'personal' ? 'شخصي' : 'شغل'}</span>
      </div>

      <details className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
        <summary className="cursor-pointer text-[12.5px] font-medium">تفاصيل المشروع</summary>
        <form action={updateProject.bind(null, p.id)} className="mt-3 flex flex-col gap-3">
          <div><label className={lbl}>الاسم</label><input name="title" defaultValue={p.title} className={field} /></div>
          {p.type === 'work' && (
            <div><label className={lbl}>المرحلة</label>
              <select name="stage" defaultValue={p.stage ?? ''} className={field}>
                <option value="">—</option>
                {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <div className="flex-1"><label className={lbl}>الحالة</label>
              <select name="status" defaultValue={p.status} className={field}>
                <option value="active">شغّال</option><option value="done">خلص</option><option value="archived">مؤرشف</option>
              </select>
            </div>
            <div className="flex-1"><label className={lbl}>الديدلاين</label><input type="date" name="deadline" defaultValue={di(p.deadline)} className={field} /></div>
          </div>
          <div><label className={lbl}>ملاحظات</label><textarea name="notes" rows={3} defaultValue={p.notes ?? ''} className={field} /></div>
          <button className="self-start rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[#1a1a1a]">حفظ</button>
        </form>
      </details>

      <form action={createTask} className="mb-3 flex gap-2">
        <input type="hidden" name="project_id" value={p.id} />
        <input name="title" required placeholder="أضف مهمة للمشروع…" className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--accent)]" />
        <button className="rounded-xl bg-[var(--accent)] px-4 text-[18px] font-light text-[#1a1a1a]">+</button>
      </form>

      <section>
        {open.map((t) => (
          <div key={t.id} className="flex items-start gap-3 border-b border-[var(--line)] py-3">
            <form action={toggleTask.bind(null, t.id)}>
              <button className="mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-[var(--line-bold)] text-transparent hover:border-[var(--accent)]">✓</button>
            </form>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-snug">{t.title}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
                <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_TONE[t.priority] }} />
                {t.context && <span>{t.context}</span>}
                {t.dueDate && <span>📅 {dateAr(t.dueDate)}</span>}
              </div>
            </div>
            <form action={deleteTask.bind(null, t.id)}><button className="shrink-0 text-[var(--text-dim)] hover:text-[var(--danger)]">×</button></form>
          </div>
        ))}
        {open.length === 0 && <p className="py-6 text-center text-[12.5px] text-[var(--text-dim)]">لا مهام مفتوحة.</p>}
      </section>

      {done.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[12px] text-[var(--text-dim)]">المكتمل ({done.length})</summary>
          <div className="mt-2">
            {done.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 text-[var(--text-dim)]">
                <form action={toggleTask.bind(null, t.id)}>
                  <button className="grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-[11px] text-[#1a1a1a]">✓</button>
                </form>
                <span className="text-[14px] line-through">{t.title}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
