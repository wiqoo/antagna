import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq, ne, asc, desc } from 'drizzle-orm';
import {
  db,
  profiles,
  projectTasks,
  dailyTasks,
  projects,
} from '@antagna/db';
import {
  
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  Avatar,
  Button,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ListChecks, Plus, CheckCircle2, Play, Circle } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { setTaskStatus, createDailyTask } from './actions';

export const dynamic = 'force-dynamic';

const PRIORITY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger' | 'success'> =
  {
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
      <Shell user={{ email: user.email ?? '' }} activePath="/tasks">
        <PageHeader title="المهام" />
        <Card>
          <EmptyState
            icon={<ListChecks size={20} />}
            title="لا يوجد profile مربوط بحسابك"
            description="سيُنشأ تلقائياً عند أول استخدام، أو في Pillar 15 migration."
          />
        </Card>
      </Shell>
    );
  }

  const myProjWhere = showAll
    ? eq(projectTasks.assigneeId, actor.id)
    : and(
        eq(projectTasks.assigneeId, actor.id),
        ne(projectTasks.status, 'completed'),
        ne(projectTasks.status, 'cancelled'),
      );

  const myDailyWhere = showAll
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
      .where(myProjWhere)
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
      .where(myDailyWhere)
      .orderBy(asc(dailyTasks.status), asc(dailyTasks.dueAt), desc(dailyTasks.createdAt)),
  ]);

  return (
    <Shell
      user={{ email: user.email ?? '', displayName: actor.displayName }}
      activePath="/tasks"
    >
      <PageHeader
        eyebrow={`مرحباً ${actor.displayName}`}
        title="مهامك"
        subtitle={`${projTasks.length + dailies.length} مهمة ${showAll ? 'في الإجمالي' : 'مفتوحة'}`}
        action={
          <Link
            href={showAll ? '/tasks' : '/tasks?show=all'}
            className="inline-flex h-9 items-center rounded-xl border border-[--line] bg-[--surface] px-3.5 text-sm text-[--text-muted] hover:border-[--accent] hover:text-[--text]"
          >
            {showAll ? 'المفتوحة فقط' : 'كل المهام'}
          </Link>
        }
      />

      {/* Quick-add daily task */}
      <Card>
        <CardHeader
          title="مهمة يومية سريعة"
          subtitle="مهام شخصية مش مرتبطة بمشروع"
        />
        <form action={createDailyTask} className="flex flex-wrap gap-2">
          <input
            type="text"
            name="title"
            required
            placeholder="ماذا تريد إنجازه اليوم؟"
            className="h-10 min-w-[240px] flex-1 rounded-xl border border-[--line] bg-[--bg-elevated] px-3 text-sm text-[--text] placeholder:text-[--text-dim] focus:border-[--accent] focus:outline-none"
          />
          <input
            type="date"
            name="dueAt"
            className="h-10 rounded-xl border border-[--line] bg-[--bg-elevated] px-3 text-sm font-mono"
          />
          <select
            name="priority"
            defaultValue="normal"
            className="h-10 rounded-xl border border-[--line] bg-[--bg-elevated] px-3 text-sm"
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </select>
          <Button variant="primary" icon={<Plus size={16} />}>
            أضف
          </Button>
        </form>
      </Card>

      {/* Project tasks */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="مهام المشاريع"
            subtitle={`${projTasks.length} مهمة من مشاريع`}
          />
        </div>
        {projTasks.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={20} />}
            title="مفيش مهام مفتوحة عليك"
            description="ممتاز — لا توجد مهام مشاريع مفتوحة."
          />
        ) : (
          <ul className="divide-y divide-[--line]">
            {projTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 px-6 py-3 hover:bg-[--surface-hover]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[--text]">{t.title}</p>
                  <p className="mt-0.5 text-xs text-[--text-muted]">
                    <Link
                      href={`/projects/${t.projectId}`}
                      className="font-mono text-[--text-dim] hover:text-[--accent]"
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
                  </p>
                </div>
                <StatusPill tone={PRIORITY_TONE[t.priority ?? 'normal']}>
                  {t.priority}
                </StatusPill>
                <StatusToggle source="project" id={t.id} status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Daily tasks */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="مهام يومية"
            subtitle={`${dailies.length} مهمة شخصية`}
          />
        </div>
        {dailies.length === 0 ? (
          <EmptyState
            icon={<Circle size={20} />}
            title="لا مهام يومية"
            description="ضيف مهمة من الفورم اللي فوق."
          />
        ) : (
          <ul className="divide-y divide-[--line]">
            {dailies.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 px-6 py-3 hover:bg-[--surface-hover]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[--text]">{t.title}</p>
                  {t.dueAt && (
                    <p className="mt-0.5 text-xs text-[--text-muted]">
                      due{' '}
                      <span className="font-mono">
                        {new Date(t.dueAt).toISOString().slice(0, 10)}
                      </span>
                    </p>
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
      </Card>

      <Avatar name="" className="hidden" />
    </Shell>
  );
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
      className="flex items-center gap-1.5"
    >
      <StatusPill tone={STATUS_TONE[status] ?? 'neutral'}>{status}</StatusPill>
      {status !== 'completed' && (
        <>
          {status === 'pending' && (
            <button
              type="submit"
              name="next"
              value="in_progress"
              title="ابدأ"
              className="grid h-7 w-7 place-items-center rounded-lg border border-[--line] bg-[--surface] text-[--text-muted] hover:border-[--accent] hover:text-[--accent]"
            >
              <Play size={12} />
            </button>
          )}
          <button
            type="submit"
            name="next"
            value="completed"
            title="إنجاز"
            className="grid h-7 w-7 place-items-center rounded-lg border border-[--line] bg-[--surface] text-[--text-muted] hover:border-emerald-500 hover:text-emerald-400"
          >
            <CheckCircle2 size={12} />
          </button>
        </>
      )}
    </form>
  );
}
