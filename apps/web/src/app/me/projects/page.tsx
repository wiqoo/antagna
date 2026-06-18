import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../auth';
import { createProject } from '../actions';
import { PROJECT_TYPES, STAGE_LABEL, dateAr } from '../data';

export const dynamic = 'force-dynamic';

interface Proj {
  id: string; title: string; type: string; stage: string | null; deadline: string | null;
  openTasks: number; doneTasks: number;
}

export default async function ProjectsPage() {
  const me = await requireOwner();
  const projects = (await db.execute(sql`
    SELECT p.id::text, p.title, p.type, p.stage, p.deadline,
      (SELECT count(*)::int FROM me_tasks t WHERE t.project_id = p.id AND t.status <> 'done') AS "openTasks",
      (SELECT count(*)::int FROM me_tasks t WHERE t.project_id = p.id AND t.status = 'done') AS "doneTasks"
    FROM me_projects p
    WHERE p.owner_id = ${me.profileId}::uuid AND p.status = 'active'
    ORDER BY p.updated_at DESC
  `)) as unknown as Proj[];

  return (
    <div>
      <h1 className="mb-4 text-[22px] font-bold">المشاريع</h1>

      <details className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
        <summary className="cursor-pointer text-[13px] font-medium text-[var(--accent)]">+ مشروع جديد</summary>
        <form action={createProject} className="mt-3 flex flex-col gap-2.5">
          <input name="title" required placeholder="اسم المشروع" className="rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]" />
          <div className="flex gap-2">
            <select name="type" className="flex-1 rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[14px]">
              {PROJECT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="date" name="deadline" className="flex-1 rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[14px]" />
          </div>
          <button className="rounded-lg bg-[var(--accent)] py-2 text-[14px] font-medium text-[#1a1a1a]">إنشاء</button>
        </form>
      </details>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-12 text-center text-[13px] text-[var(--text-dim)]">لا مشاريع بعد.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {projects.map((p) => (
            <Link key={p.id} href={`/me/projects/${p.id}`} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 active:bg-[var(--surface-hover)]">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium">{p.title}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-dim)]" style={{ background: 'var(--surface2)' }}>
                  {p.type === 'personal' ? 'شخصي' : 'شغل'}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--text-dim)]">
                {p.type === 'work' && p.stage && <span>🔵 {STAGE_LABEL[p.stage] ?? p.stage}</span>}
                <span>{p.openTasks} مهمة مفتوحة</span>
                {p.deadline && <span>📅 {dateAr(p.deadline)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
