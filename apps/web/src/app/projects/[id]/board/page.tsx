import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, StatusPill, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, CheckCircle2, Play, PauseOctagon, RotateCcw, X } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { setTaskStatus } from '@/app/tasks/actions';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type Task = {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  priority: string | null;
  dueAt: string | null;
  assigneeName: string | null;
};

const PRIORITY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

const COLUMNS: Array<{
  key: Task['status'];
  label: string;
  tone: 'neutral' | 'info' | 'warning' | 'success';
}> = [
  { key: 'pending', label: 'مفتوحة', tone: 'neutral' },
  { key: 'in_progress', label: 'قيد التنفيذ', tone: 'info' },
  { key: 'blocked', label: 'متوقّفة', tone: 'warning' },
  { key: 'completed', label: 'منجزة', tone: 'success' },
];

function fmtDue(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const isPast = d.getTime() < now.getTime();
  const text = d.toISOString().slice(0, 10);
  return { text, isPast };
}

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/projects/${id}/board`);

  const [pR, tR] = await Promise.all([
    db.execute(sql`
      SELECT id::text AS id, COALESCE(title_ar, title) AS title, stage::text AS stage
      FROM projects WHERE id = ${id}::uuid LIMIT 1`),
    db.execute(sql`
      SELECT pt.id::text AS id, pt.title, pt.status::text AS status,
             pt.priority::text AS priority, pt.due_at AS "dueAt",
             p.display_name AS "assigneeName"
      FROM project_tasks pt
      LEFT JOIN profiles p ON p.id = pt.assignee_id
      WHERE pt.project_id = ${id}::uuid
      ORDER BY pt.priority DESC NULLS LAST, pt.due_at ASC NULLS LAST`),
  ]);

  const project = rows<{ id: string; title: string; stage: string }>(pR)[0];
  if (!project) notFound();
  const tasks = rows<Task>(tR);

  const byStatus = new Map<Task['status'], Task[]>();
  for (const col of COLUMNS) byStatus.set(col.key, []);
  for (const t of tasks) {
    const arr = byStatus.get(t.status);
    if (arr) arr.push(t);
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/projects">
      <Link
        href={`/projects/${project.id}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> {project.title}
      </Link>

      <PageHeader
        eyebrow="لوحة المهام"
        title={project.title}
        subtitle={`${tasks.length} مهمة في المشروع`}
        action={
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex h-9 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)]"
          >
            العودة لتفاصيل المشروع
          </Link>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={20} />}
          title="لا مهام بعد"
          description="أضف أول مهمة من تفاصيل المشروع."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const list = byStatus.get(col.key) ?? [];
            return (
              <section
                key={col.key}
                className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)]"
              >
                <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <StatusPill tone={col.tone} withDot={false}>
                      {col.label}
                    </StatusPill>
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-dim)]">
                    {list.length}
                  </span>
                </header>
                <div className="flex flex-col gap-2 p-2">
                  {list.length === 0 ? (
                    <p className="px-2 py-3 text-center text-[11px] text-[var(--text-dim)]">
                      —
                    </p>
                  ) : (
                    list.map((t) => (
                      <TaskCard key={t.id} task={t} projectId={project.id} />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

function TaskCard({ task, projectId }: { task: Task; projectId: string }) {
  const due = fmtDue(task.dueAt);
  return (
    <article className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-2.5 text-[12px]">
      <p className="font-medium leading-snug text-[var(--text)]">{task.title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        {task.priority && task.priority !== 'normal' && (
          <StatusPill tone={PRIORITY_TONE[task.priority] ?? 'neutral'} withDot={false}>
            {task.priority}
          </StatusPill>
        )}
        {due && (
          <span
            className={
              'font-mono ' +
              (due.isPast && task.status !== 'completed'
                ? 'text-[var(--danger)]'
                : 'text-[var(--text-dim)]')
            }
            dir="ltr"
          >
            {due.text}
          </span>
        )}
        {task.assigneeName && (
          <span className="text-[var(--text-muted)]">{task.assigneeName}</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {task.status === 'pending' && (
          <>
            <Move
              taskId={task.id}
              to="in_progress"
              label="ابدأ"
              icon={<Play size={11} />}
              projectId={projectId}
            />
            <Move
              taskId={task.id}
              to="completed"
              label="منجزة"
              icon={<CheckCircle2 size={11} />}
              projectId={projectId}
            />
          </>
        )}
        {task.status === 'in_progress' && (
          <>
            <Move
              taskId={task.id}
              to="completed"
              label="منجزة"
              icon={<CheckCircle2 size={11} />}
              tone="success"
              projectId={projectId}
            />
            <Move
              taskId={task.id}
              to="blocked"
              label="معطَّلة"
              icon={<PauseOctagon size={11} />}
              tone="warning"
              projectId={projectId}
            />
          </>
        )}
        {task.status === 'blocked' && (
          <>
            <Move
              taskId={task.id}
              to="in_progress"
              label="استأنف"
              icon={<Play size={11} />}
              projectId={projectId}
            />
            <Move
              taskId={task.id}
              to="cancelled"
              label="ألغِ"
              icon={<X size={11} />}
              tone="danger"
              projectId={projectId}
            />
          </>
        )}
        {(task.status === 'completed' || task.status === 'cancelled') && (
          <Move
            taskId={task.id}
            to="pending"
            label="أعد الفتح"
            icon={<RotateCcw size={11} />}
            projectId={projectId}
          />
        )}
      </div>
    </article>
  );
}

function Move({
  taskId,
  to,
  label,
  icon,
  tone,
  projectId,
}: {
  taskId: string;
  to: Task['status'];
  label: string;
  icon: React.ReactNode;
  tone?: 'success' | 'warning' | 'danger';
  projectId: string;
}) {
  async function move() {
    'use server';
    await setTaskStatus('project', taskId, to);
    // setTaskStatus already revalidates /tasks; also bust the board route.
    const { revalidatePath } = await import('next/cache');
    revalidatePath(`/projects/${projectId}/board`);
  }
  const toneClass =
    tone === 'success'
      ? 'border-[var(--success)]/40 text-[var(--success)]'
      : tone === 'warning'
        ? 'border-[var(--warning)]/40 text-[var(--warning)]'
        : tone === 'danger'
          ? 'border-[var(--danger)]/40 text-[var(--danger)]'
          : 'border-[var(--line)] text-[var(--text-muted)]';
  return (
    <form action={move}>
      <button
        type="submit"
        className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] hover:border-[var(--accent)] hover:text-[var(--accent)] ${toneClass}`}
      >
        {icon} {label}
      </button>
    </form>
  );
}
