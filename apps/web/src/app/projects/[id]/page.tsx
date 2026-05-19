import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { desc, eq, sql, and, isNull } from 'drizzle-orm';
import {
  db,
  projects,
  projectStagesLog,
  projectAssignments,
  projectTasks,
  projectComments,
  clients,
  contacts,
  profiles,
  freelancers,
  deliverables,
  deliverableGroups,
} from '@antagna/db';
import { AppShell, StatusPill, MoneyDisplay } from '@antagna/ui';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { stageTone, stageLabelAr } from '@/lib/project-stage';
import { transitionStage, postComment } from './actions';

export const dynamic = 'force-dynamic';

const STAGE_TRANSITIONS: Record<string, string[]> = {
  lead: ['brief', 'lost', 'cancelled'],
  brief: ['quoted', 'lost', 'cancelled'],
  quoted: ['approved', 'lost', 'cancelled'],
  approved: ['planning', 'cancelled'],
  planning: ['shooting', 'cancelled'],
  shooting: ['editing', 'cancelled'],
  editing: ['review', 'shooting'],
  review: ['delivered', 'editing'],
  delivered: ['archived'],
  archived: [],
  lost: ['archived'],
  cancelled: ['archived'],
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/projects/${id}`);

  const [project] = await db
    .select({
      id: projects.id,
      code: projects.code,
      title: projects.title,
      titleAr: projects.titleAr,
      description: projects.description,
      stage: projects.stage,
      projectType: projects.projectType,
      contractedValueSar: projects.contractedValueSar,
      briefReceivedAt: projects.briefReceivedAt,
      quotedAt: projects.quotedAt,
      approvedAt: projects.approvedAt,
      shootStartsAt: projects.shootStartsAt,
      shootEndsAt: projects.shootEndsAt,
      deliveryDueAt: projects.deliveryDueAt,
      deliveredAt: projects.deliveredAt,
      archivedAt: projects.archivedAt,
      aiStatusParagraph: projects.aiStatusParagraph,
      aiRiskLevel: projects.aiRiskLevel,
      aiNextAction: projects.aiNextAction,
      driveFolderUrl: projects.driveFolderUrl,
      notes: projects.notes,
      clientId: projects.clientId,
      clientCode: clients.code,
      clientNameAr: clients.nameAr,
      clientNameEn: clients.nameEn,
      pmName: profiles.displayName,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(profiles, eq(profiles.id, projects.projectManagerId))
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) notFound();

  const [
    stageLog,
    assignments,
    tasks,
    comments,
    delivStats,
    contactList,
  ] = await Promise.all([
    db
      .select({
        id: projectStagesLog.id,
        fromStage: projectStagesLog.fromStage,
        toStage: projectStagesLog.toStage,
        changedAt: projectStagesLog.changedAt,
        reason: projectStagesLog.reason,
        changedByName: profiles.displayName,
      })
      .from(projectStagesLog)
      .leftJoin(profiles, eq(profiles.id, projectStagesLog.changedBy))
      .where(eq(projectStagesLog.projectId, id))
      .orderBy(desc(projectStagesLog.changedAt))
      .limit(10),
    db
      .select({
        id: projectAssignments.id,
        role: projectAssignments.role,
        profileName: profiles.displayName,
        freelancerName: freelancers.fullName,
        externalName: projectAssignments.externalName,
        rateSar: projectAssignments.rateSar,
        rateUnit: projectAssignments.rateUnit,
      })
      .from(projectAssignments)
      .leftJoin(profiles, eq(profiles.id, projectAssignments.profileId))
      .leftJoin(freelancers, eq(freelancers.id, projectAssignments.freelancerId))
      .where(eq(projectAssignments.projectId, id))
      .orderBy(projectAssignments.assignedAt),
    db
      .select({
        id: projectTasks.id,
        title: projectTasks.title,
        status: projectTasks.status,
        priority: projectTasks.priority,
        dueAt: projectTasks.dueAt,
        assigneeName: profiles.displayName,
      })
      .from(projectTasks)
      .leftJoin(profiles, eq(profiles.id, projectTasks.assigneeId))
      .where(eq(projectTasks.projectId, id))
      .orderBy(projectTasks.position, desc(projectTasks.createdAt))
      .limit(50),
    db
      .select({
        id: projectComments.id,
        body: projectComments.body,
        createdAt: projectComments.createdAt,
        authorName: profiles.displayName,
      })
      .from(projectComments)
      .leftJoin(profiles, eq(profiles.id, projectComments.authorId))
      .where(and(eq(projectComments.projectId, id), isNull(projectComments.deletedAt)))
      .orderBy(desc(projectComments.createdAt))
      .limit(50),
    db
      .select({
        status: deliverables.status,
        count: sql<number>`count(*)::int`,
      })
      .from(deliverables)
      .where(eq(deliverables.projectId, id))
      .groupBy(deliverables.status),
    db
      .select({
        side: sql<string>`pc.side`,
        roleLabel: sql<string>`pc.role_label`,
        fullName: contacts.fullName,
        jobTitle: contacts.jobTitle,
      })
      .from(sql`project_contacts pc`)
      .innerJoin(contacts, sql`${contacts.id} = pc.contact_id`)
      .where(sql`pc.project_id = ${id}::uuid`),
  ]);

  const totalDeliverables = delivStats.reduce((s, r) => s + Number(r.count), 0);
  const deliveredCount = delivStats.find((r) => r.status === 'delivered')?.count ?? 0;
  const inReviewCount =
    (delivStats.find((r) => r.status === 'in_client_review')?.count ?? 0) +
    (delivStats.find((r) => r.status === 'pending_director')?.count ?? 0) +
    (delivStats.find((r) => r.status === 'pending_am')?.count ?? 0);

  const openTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const blockedTasks = tasks.filter((t) => t.status === 'blocked');

  const nextStages = STAGE_TRANSITIONS[project.stage] ?? [];

  return (
    <AppShell user={{ email: user.email ?? '' }} activePath="/projects">
      <div className="space-y-5">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-yellow-500"
        >
          ← كل المشاريع
        </Link>

        <header className="rounded-md border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-neutral-500">{project.code}</span>
                <StatusPill tone={stageTone(project.stage)}>
                  {stageLabelAr(project.stage)}
                </StatusPill>
                {project.aiRiskLevel && (
                  <StatusPill
                    tone={
                      project.aiRiskLevel === 'red'
                        ? 'danger'
                        : project.aiRiskLevel === 'amber'
                          ? 'warning'
                          : 'success'
                    }
                  >
                    risk: {project.aiRiskLevel}
                  </StatusPill>
                )}
              </div>
              <h1 className="text-2xl font-semibold">{project.titleAr ?? project.title}</h1>
              {project.titleAr && project.title && (
                <p className="text-sm text-neutral-500">{project.title}</p>
              )}
              <p className="text-sm text-neutral-400">
                <span className="font-mono text-neutral-500">{project.clientCode}</span>{' '}
                · {project.clientNameAr}
                {project.pmName && (
                  <>
                    {' '}· PM: <span className="text-neutral-300">{project.pmName}</span>
                  </>
                )}
              </p>
            </div>

            <div className="text-right">
              {project.contractedValueSar && (
                <MoneyDisplay
                  amount={Number(project.contractedValueSar)}
                  currency="SAR"
                  className="text-xl"
                />
              )}
              {project.deliveryDueAt && (
                <p className="mt-1 font-mono text-xs text-neutral-500">
                  due {new Date(project.deliveryDueAt).toISOString().slice(0, 10)}
                </p>
              )}
            </div>
          </div>

          {project.aiStatusParagraph && (
            <p className="mt-4 border-t border-neutral-800 pt-3 text-sm text-neutral-300">
              <span className="text-xs uppercase tracking-wide text-neutral-500">AI status:</span>{' '}
              {project.aiStatusParagraph}
            </p>
          )}
        </header>

        {nextStages.length > 0 && (
          <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
              نقل المرحلة
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {nextStages.map((s) => (
                <form
                  key={s}
                  action={async (formData: FormData) => {
                    'use server';
                    const reason = formData.get('reason')?.toString() ?? null;
                    await transitionStage(id, s as (typeof project)['stage'], reason);
                  }}
                  className="flex items-center gap-1"
                >
                  {(s === 'lost' || s === 'cancelled') && (
                    <input
                      type="text"
                      name="reason"
                      required
                      placeholder="السبب"
                      className="w-32 rounded-sm border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs"
                    />
                  )}
                  <button
                    type="submit"
                    className="rounded-sm border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs hover:border-yellow-500"
                  >
                    → {stageLabelAr(s)}
                  </button>
                </form>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard
            label="فريق المشروع"
            value={assignments.length}
            sub={
              assignments.length
                ? `${assignments.filter((a) => a.profileName).length} داخلي`
                : '—'
            }
          />
          <StatCard
            label="المهام"
            value={`${openTasks.length} مفتوح`}
            sub={
              blockedTasks.length ? `${blockedTasks.length} blocked` : `${tasks.length} الإجمالي`
            }
            tone={blockedTasks.length > 0 ? 'danger' : 'info'}
          />
          <StatCard
            label="المخرجات"
            value={`${deliveredCount} / ${totalDeliverables}`}
            sub={inReviewCount > 0 ? `${inReviewCount} قيد المراجعة` : '—'}
            tone={inReviewCount > 0 ? 'warning' : 'info'}
          />
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">المهام</h2>
            {tasks.length === 0 ? (
              <p className="text-xs text-neutral-500">لا توجد مهام.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {tasks.slice(0, 8).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-3 border-b border-neutral-800 pb-1.5 last:border-0"
                  >
                    <div className="flex-1">
                      <div>{t.title}</div>
                      <div className="text-xs text-neutral-500">
                        {t.assigneeName ?? '—'}
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
                    <StatusPill
                      tone={
                        t.status === 'completed'
                          ? 'success'
                          : t.status === 'blocked'
                            ? 'danger'
                            : t.status === 'in_progress'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {t.status}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
              الفريق المعيَّن
            </h2>
            {assignments.length === 0 ? (
              <p className="text-xs text-neutral-500">لا تعيينات بعد.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between border-b border-neutral-800 pb-1 last:border-0"
                  >
                    <div>
                      <div>{a.profileName ?? a.freelancerName ?? a.externalName}</div>
                      <div className="text-xs text-neutral-500">{a.role}</div>
                    </div>
                    {a.rateSar && (
                      <div className="font-mono text-xs text-neutral-500">
                        {Number(a.rateSar).toLocaleString('en-US')} ر.س / {a.rateUnit}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
              التعليقات
            </h2>
            <form
              action={async (formData: FormData) => {
                'use server';
                const body = formData.get('body')?.toString() ?? '';
                await postComment(id, body);
              }}
              className="mb-3 flex gap-2"
            >
              <input
                type="text"
                name="body"
                required
                placeholder="اكتب تعليق…"
                className="flex-1 rounded-sm border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded-sm bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-yellow-400"
              >
                إرسال
              </button>
            </form>
            {comments.length === 0 ? (
              <p className="text-xs text-neutral-500">لا تعليقات بعد.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {comments.slice(0, 8).map((c) => (
                  <li key={c.id} className="border-b border-neutral-800 pb-2 last:border-0">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{c.authorName ?? '?'}</span>
                      <span className="font-mono">
                        {new Date(c.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
              سجل المراحل
            </h2>
            {stageLog.length === 0 ? (
              <p className="text-xs text-neutral-500">لا انتقالات بعد.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {stageLog.map((s) => (
                  <li key={s.id} className="flex items-center justify-between">
                    <span>
                      <span className="text-neutral-500">{stageLabelAr(s.fromStage)}</span>
                      <span className="mx-1.5 text-neutral-600">→</span>
                      <span>{stageLabelAr(s.toStage)}</span>
                      {s.reason && <span className="ml-2 text-neutral-500">— {s.reason}</span>}
                    </span>
                    <span className="font-mono text-neutral-500">
                      {s.changedByName ?? '?'} ·{' '}
                      {new Date(s.changedAt).toISOString().slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {contactList.length > 0 && (
          <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
              جهات الاتصال
            </h2>
            <ul className="space-y-1 text-sm">
              {contactList.map((c, i) => (
                <li key={i} className="flex items-center justify-between border-b border-neutral-800 pb-1 last:border-0">
                  <div>
                    <div>{c.fullName}</div>
                    {(c.jobTitle || c.roleLabel) && (
                      <div className="text-xs text-neutral-500">
                        {c.jobTitle ?? ''}{c.roleLabel && c.jobTitle ? ' · ' : ''}{c.roleLabel ?? ''}
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-xs text-neutral-500">{c.side}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(project.driveFolderUrl || project.notes) && (
          <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4 text-sm">
            {project.driveFolderUrl && (
              <p>
                <span className="text-xs uppercase tracking-wide text-neutral-500">Drive:</span>{' '}
                <a
                  href={project.driveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-yellow-500 hover:underline"
                >
                  {project.driveFolderUrl}
                </a>
              </p>
            )}
            {project.notes && (
              <p className="mt-2 whitespace-pre-wrap text-neutral-300">{project.notes}</p>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = 'info',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
}) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wide text-neutral-500">{label}</h3>
        <StatusPill tone={tone}>—</StatusPill>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}
