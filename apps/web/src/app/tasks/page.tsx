import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq, ne, or, asc, desc, isNull } from 'drizzle-orm';
import {
  db,
  profiles,
  projectTasks,
  dailyTasks,
  projects,
} from '@antagna/db';
import { AppShell, StatusPill } from '@antagna/ui';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { setTaskStatus, createDailyTask } from './actions';

export const dynamic = 'force-dynamic';

const PRIORITY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger' | 'success'> = {
  pending: 'neutral',
  in_progress: 'warning',
  blocked: 'danger',
  completed: 'success',
  cancelled: 'neutral',
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const sp = await searchParams;
  const showAll = sp.show === 'all';

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/tasks');

  const [actor] = await db
    .select({ id: profiles.id, displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  if (!actor) {
    return (
      <AppShell user={{ email: user.email ?? '' }} activePath="/tasks">
        <p className="text-sm text-neutral-500">لا يوجد profile مربوط بحسابك بعد.</p>
      </AppShell>
    );
  }

  const myProjectTasksWhere = showAll
    ? eq(projectTasks.assigneeId, actor.id)
    : and(
        eq(projectTasks.assigneeId, actor.id),
        ne(projectTasks.status, 'completed'),
        ne(projectTasks.status, 'cancelled'),
      );

  const myDailyTasksWhere = showAll
    ? eq(dailyTasks.ownerId, actor.id)
    : and(
        eq(dailyTasks.ownerId, actor.id),
        ne(dailyTasks.status, 'completed'),
        ne(dailyTasks.status, 'cancelled'),
      );

  const [projTasks, dailies] = await Promise.all([
    db
      .select({
        id: projectTasks.id,
        title: projectTasks.title,
        status: projectTasks.status,
        priority: projectTasks.priority,
        dueAt: projectTasks.dueAt,
        projectId: projects.id,
        projectCode: projects.code,
        projectTitleAr: projects.titleAr,
        projectTitle: projects.title,
      })
      .from(projectTasks)
      .innerJoin(projects, eq(projects.id, projectTasks.projectId))
      .where(myProjectTasksWhere)
      .orderBy(
        asc(projectTasks.status),
        asc(projectTasks.dueAt),
        desc(projectTasks.createdAt),
      ),
    db
      .select({
        id: dailyTasks.id,
        title: dailyTasks.title,
        status: dailyTasks.status,
        priority: dailyTasks.priority,
        dueAt: dailyTasks.dueAt,
      })
      .from(dailyTasks)
      .where(myDailyTasksWhere)
      .orderBy(asc(dailyTasks.status), asc(dailyTasks.dueAt), desc(dailyTasks.createdAt)),
  ]);

  return (
    <AppShell user={{ email: user.email ?? '' }} activePath="/tasks">
      <div className="space-y-5">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold">المهام</h1>
            <p className="text-sm text-neutral-500">
              {actor.displayName} · {projTasks.length + dailies.length} task
              {projTasks.length + dailies.length === 1 ? '' : 's'}
            </p>
          </div>
          <Link
            href={showAll ? '/tasks' : '/tasks?show=all'}
            className="rounded-sm border border-neutral-800 px-3 py-1 text-xs hover:border-yellow-500"
          >
            {showAll ? 'مفتوحة فقط' : 'كل المهام'}
          </Link>
        </header>

        <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
            مهمة يومية جديدة
          </h2>
          <form action={createDailyTask} className="flex flex-wrap gap-2">
            <input
              type="text"
              name="title"
              required
              placeholder="ماذا تريد أن تنجز اليوم؟"
              className="flex-1 min-w-[200px] rounded-sm border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm"
            />
            <input
              type="date"
              name="dueAt"
              className="rounded-sm border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm font-mono"
            />
            <select
              name="priority"
              defaultValue="normal"
              className="rounded-sm border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm"
            >
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
            <button
              type="submit"
              className="rounded-sm bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-yellow-400"
            >
              + أضف
            </button>
          </form>
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            مهام المشاريع ({projTasks.length})
          </h2>
          <div className="overflow-hidden rounded-md border border-neutral-800">
            {projTasks.length === 0 ? (
              <div className="bg-neutral-950 px-3 py-6 text-center text-xs text-neutral-500">
                لا توجد مهام مفتوحة عليك.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-800 bg-neutral-950 text-sm">
                {projTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex-1">
                      <div>{t.title}</div>
                      <div className="text-xs text-neutral-500">
                        <Link
                          href={`/projects/${t.projectId}`}
                          className="font-mono hover:text-yellow-500"
                        >
                          {t.projectCode}
                        </Link>{' '}
                        · {t.projectTitleAr ?? t.projectTitle}
                        {t.dueAt && (
                          <>
                            {' '}· due{' '}
                            <span className="font-mono">
                              {new Date(t.dueAt).toISOString().slice(0, 10)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <StatusPill tone={PRIORITY_TONE[t.priority ?? 'normal']}>
                      {t.priority}
                    </StatusPill>
                    <StatusToggle source="project" id={t.id} status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            مهام يومية ({dailies.length})
          </h2>
          <div className="overflow-hidden rounded-md border border-neutral-800">
            {dailies.length === 0 ? (
              <div className="bg-neutral-950 px-3 py-6 text-center text-xs text-neutral-500">
                لا مهام يومية.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-800 bg-neutral-950 text-sm">
                {dailies.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex-1">
                      <div>{t.title}</div>
                      {t.dueAt && (
                        <div className="text-xs text-neutral-500">
                          due{' '}
                          <span className="font-mono">
                            {new Date(t.dueAt).toISOString().slice(0, 10)}
                          </span>
                        </div>
                      )}
                    </div>
                    <StatusPill tone={PRIORITY_TONE[t.priority ?? 'normal']}>
                      {t.priority}
                    </StatusPill>
                    <StatusToggle source="daily" id={t.id} status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );

  // suppress unused-import warnings
  void or;
  void isNull;
}

function StatusToggle({
  source,
  id,
  status,
}: {
  source: 'project' | 'daily';
  id: string;
  status: string;
}) {
  return (
    <form
      action={async (formData: FormData) => {
        'use server';
        const next = formData.get('next')?.toString() as
          | 'pending'
          | 'in_progress'
          | 'completed'
          | 'blocked';
        await setTaskStatus(source, id, next);
      }}
      className="flex items-center gap-1"
    >
      <StatusPill tone={STATUS_TONE[status] ?? 'neutral'}>{status}</StatusPill>
      {status !== 'completed' && (
        <>
          {status === 'pending' && (
            <button
              type="submit"
              name="next"
              value="in_progress"
              className="rounded-sm border border-neutral-800 px-2 py-0.5 text-xs hover:border-yellow-500"
            >
              ابدأ
            </button>
          )}
          <button
            type="submit"
            name="next"
            value="completed"
            className="rounded-sm border border-neutral-800 px-2 py-0.5 text-xs hover:border-yellow-500"
          >
            ✓
          </button>
        </>
      )}
    </form>
  );
}
