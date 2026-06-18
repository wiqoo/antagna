import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../../auth';
import { createTask, toggleTask, deleteTask, updateProject } from '../../actions';
import { seedChecklist, toggleChecklistItem, addChecklistItem, addDeliverable, setDeliverableStatus } from '../../actions2';
import { STAGES, STAGE_LABEL, PRIORITY_TONE, dateAr } from '../../data';

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

  const [checklist, deliverables] = (await Promise.all([
    p.type === 'work' && p.stage
      ? db.execute(sql`SELECT id::text, item, is_done AS "isDone" FROM me_checklist WHERE project_id=${id}::uuid AND stage=${p.stage} ORDER BY position, created_at`)
      : Promise.resolve([]),
    db.execute(sql`SELECT id::text, title, link, version, status FROM me_deliverables WHERE project_id=${id}::uuid AND owner_id=${me.profileId}::uuid ORDER BY created_at DESC`),
  ])) as unknown as [Array<{ id: string; item: string; isDone: boolean }>, Array<{ id: string; title: string; link: string | null; version: number; status: string }>];

  const DSTATUS: Record<string, { label: string; tone: string }> = {
    pending: { label: 'قيد المراجعة', tone: 'var(--warning)' },
    approved: { label: 'معتمد', tone: 'var(--success)' },
    revisions: { label: 'تعديلات', tone: 'var(--danger)' },
  };

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

      {/* stage checklist (work projects) */}
      {p.type === 'work' && p.stage && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">✅ تشيك ليست — {STAGE_LABEL[p.stage] ?? p.stage}</h2>
            {checklist.length === 0 && (
              <form action={seedChecklist.bind(null, p.id, p.stage)}>
                <button className="rounded-lg border border-[var(--line-strong)] px-2.5 py-1 text-[11px] text-[var(--accent)]">جهّز القائمة</button>
              </form>
            )}
          </div>
          {checklist.map((ci) => (
            <form key={ci.id} action={toggleChecklistItem.bind(null, ci.id, p.id)} className="flex items-center gap-2.5 py-1.5">
              <button className="grid h-5 w-5 place-items-center rounded border text-[11px]" style={{ background: ci.isDone ? 'var(--accent)' : 'transparent', borderColor: ci.isDone ? 'transparent' : 'var(--line-bold)', color: ci.isDone ? '#1a1a1a' : 'transparent' }}>✓</button>
              <span className="text-[13.5px]" style={{ textDecoration: ci.isDone ? 'line-through' : 'none', color: ci.isDone ? 'var(--text-dim)' : 'var(--text)' }}>{ci.item}</span>
            </form>
          ))}
          <form action={addChecklistItem.bind(null, p.id, p.stage)} className="mt-1.5 flex gap-2">
            <input name="item" required placeholder="+ بند" className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]" />
            <button className="rounded-lg border border-[var(--line)] px-3 text-[14px]">+</button>
          </form>
        </section>
      )}

      {/* deliverables */}
      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-semibold">🎬 المخرجات</h2>
        {deliverables.map((d) => (
          <div key={d.id} className="mb-2 flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
            <div className="min-w-0">
              {d.link ? <a href={d.link} target="_blank" rel="noreferrer" className="text-[13px] text-[var(--accent)]">▶ {d.title}</a> : <span className="text-[13px]">{d.title}</span>}
              <span className="ms-1.5 text-[10px] text-[var(--text-dim)]">v{d.version}</span>
            </div>
            <details className="relative">
              <summary className="cursor-pointer rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--surface2)', color: DSTATUS[d.status]?.tone }}>{DSTATUS[d.status]?.label}</summary>
              <div className="absolute end-0 z-10 mt-1 flex gap-1 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-1">
                {(['pending', 'revisions', 'approved'] as const).map((s) => (
                  <form key={s} action={setDeliverableStatus.bind(null, d.id, p.id, s)}><button className="rounded px-2 py-1 text-[10px]" style={{ color: DSTATUS[s]?.tone }}>{DSTATUS[s]?.label}</button></form>
                ))}
              </div>
            </details>
          </div>
        ))}
        <form action={addDeliverable.bind(null, p.id)} className="mt-1.5 flex flex-col gap-2 rounded-lg border border-[var(--line)] p-2.5">
          <input name="title" required placeholder="اسم المخرج (مثال: أول كت)" className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]" />
          <div className="flex gap-2">
            <input name="link" placeholder="لينك (Frame.io / Drive)" className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]" />
            <button className="rounded-lg bg-[var(--accent)] px-4 text-[14px] font-light text-[#1a1a1a]">+</button>
          </div>
        </form>
      </section>
    </div>
  );
}
