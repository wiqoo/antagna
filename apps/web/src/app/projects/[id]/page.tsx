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
  projectAssignmentRoleEnum,
} from '@antagna/db';
import {
  AppShell,
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  MoneyDisplay,
  EmptyState,
  Avatar,
  Button,
} from '@antagna/ui';
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  Users2,
  ListChecks,
  Package2,
  MessageSquare,
  History,
  Sparkles,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { stageTone, stageLabelAr } from '@/lib/project-stage';
import { transitionStage, postComment } from './actions';
import {
  addAssignment,
  addProjectTask,
  removeAssignment,
} from './edit/actions';

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

  const activeProfiles = await db
    .select({ id: profiles.id, displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.status, 'active'))
    .orderBy(profiles.displayName);

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

  const [stageLog, assignments, tasks, comments, delivStats, contactList] =
    await Promise.all([
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
        .leftJoin(
          freelancers,
          eq(freelancers.id, projectAssignments.freelancerId),
        )
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
        .where(
          and(eq(projectComments.projectId, id), isNull(projectComments.deletedAt)),
        )
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

  const totalDeliv = delivStats.reduce((s, r) => s + Number(r.count), 0);
  const deliveredCount = delivStats.find((r) => r.status === 'delivered')?.count ?? 0;
  const inReview =
    (delivStats.find((r) => r.status === 'in_client_review')?.count ?? 0) +
    (delivStats.find((r) => r.status === 'pending_director')?.count ?? 0) +
    (delivStats.find((r) => r.status === 'pending_am')?.count ?? 0);

  const openTasks = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress',
  );
  const blockedTasks = tasks.filter((t) => t.status === 'blocked');

  const nextStages = STAGE_TRANSITIONS[project.stage] ?? [];

  return (
    <AppShell user={{ email: user.email ?? '' }} activePath="/projects">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-[--accent]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" />
        كل المشاريع
      </Link>

      {/* Hero */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -end-32 -top-32 h-80 w-80 rounded-full bg-[--accent] opacity-[0.06] blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[--surface] px-2 py-0.5 font-mono text-[11px] text-[--text-muted]">
                  {project.code}
                </span>
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
                    خطر: {project.aiRiskLevel}
                  </StatusPill>
                )}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[--text]">
                {project.titleAr ?? project.title}
              </h1>
              {project.titleAr && project.title && (
                <p className="text-sm text-[--text-muted]">{project.title}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[--text-muted]">
                <span>
                  <span className="text-[--text-dim]">العميل: </span>
                  <span className="text-[--text]">
                    {project.clientNameAr}
                  </span>
                </span>
                {project.pmName && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-[--text-dim]">PM:</span>
                    <Avatar name={project.pmName} size="sm" />
                    <span className="text-[--text]">{project.pmName}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <Link
                href={`/projects/${id}/edit`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[--line] bg-[--surface] px-3 text-sm text-[--text-muted] hover:border-[--accent] hover:text-[--text]"
              >
                <Pencil size={14} />
                تعديل
              </Link>
              <div className="text-end">
                {project.contractedValueSar && (
                  <MoneyDisplay
                    amount={Number(project.contractedValueSar)}
                    currency="SAR"
                    className="text-2xl"
                  />
                )}
                {project.deliveryDueAt && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[--text-muted]">
                    <Calendar size={12} />
                    تسليم:{' '}
                    <span className="font-mono text-[--text]">
                      {new Date(project.deliveryDueAt).toISOString().slice(0, 10)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {project.aiStatusParagraph && (
            <div className="mt-6 rounded-2xl border border-[--accent]/20 bg-[--accent]/[0.04] p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[--accent]">
                <Sparkles size={12} />
                تحليل ذكي
              </div>
              <p className="text-sm leading-relaxed text-[--text]">
                {project.aiStatusParagraph}
              </p>
              {project.aiNextAction && (
                <p className="mt-2 text-sm text-[--text-muted]">
                  <span className="text-[--text-dim]">الخطوة التالية: </span>
                  {project.aiNextAction}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Stage transitions */}
      {nextStages.length > 0 && (
        <Card>
          <CardHeader
            title="نقل المرحلة"
            subtitle="انتقل بالمشروع إلى المرحلة التالية في الـ pipeline"
          />
          <div className="flex flex-wrap items-center gap-2">
            {nextStages.map((s) => (
              <form
                key={s}
                action={async (formData: FormData) => {
                  'use server';
                  const reason = formData.get('reason')?.toString() ?? null;
                  await transitionStage(
                    id,
                    s as (typeof project)['stage'],
                    reason,
                  );
                }}
                className="flex items-center gap-1.5"
              >
                {(s === 'lost' || s === 'cancelled') && (
                  <input
                    type="text"
                    name="reason"
                    required
                    placeholder="السبب…"
                    className="h-9 w-36 rounded-xl border border-[--line] bg-[--bg-elevated] px-3 text-xs"
                  />
                )}
                <Button
                  variant={
                    s === 'lost' || s === 'cancelled' ? 'danger' : 'secondary'
                  }
                  size="sm"
                  type="submit"
                >
                  → {stageLabelAr(s)}
                </Button>
              </form>
            ))}
          </div>
        </Card>
      )}

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SimpleStat
          icon={<Users2 size={18} />}
          label="فريق المشروع"
          value={assignments.length}
          sub={
            assignments.length
              ? `${assignments.filter((a) => a.profileName).length} داخلي`
              : 'لا تعيينات بعد'
          }
        />
        <SimpleStat
          icon={<ListChecks size={18} />}
          label="المهام"
          value={openTasks.length}
          sub={
            blockedTasks.length
              ? `${blockedTasks.length} blocked`
              : `${tasks.length} الإجمالي`
          }
          tone={blockedTasks.length > 0 ? 'danger' : 'default'}
        />
        <SimpleStat
          icon={<Package2 size={18} />}
          label="المخرجات"
          value={`${deliveredCount} / ${totalDeliv}`}
          sub={inReview > 0 ? `${inReview} قيد المراجعة` : 'لا مراجعات نشطة'}
          tone={inReview > 0 ? 'warning' : 'default'}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tasks */}
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title="المهام"
              subtitle={`${tasks.length} مهمة في المجموع`}
            />
            <form
              action={addProjectTask.bind(null, id)}
              className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr,140px,120px,auto]"
            >
              <input
                type="text"
                name="title"
                required
                placeholder="مهمة جديدة…"
                className="h-9 rounded-xl border border-[--line] bg-[--bg-elevated] px-3 text-sm"
              />
              <select
                name="assigneeId"
                defaultValue=""
                className="h-9 rounded-xl border border-[--line] bg-[--bg-elevated] px-2 text-sm"
              >
                <option value="">— assignee —</option>
                {activeProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="dueAt"
                className="h-9 rounded-xl border border-[--line] bg-[--bg-elevated] px-2 text-sm font-mono"
              />
              <Button variant="primary" size="sm" icon={<Plus size={14} />}>
                إضافة
              </Button>
            </form>
          </div>
          {tasks.length === 0 ? (
            <EmptyState
              icon={<ListChecks size={20} />}
              title="لا توجد مهام بعد"
              description="أضف مهام من الفورم اللي فوق."
            />
          ) : (
            <ul className="divide-y divide-[--line]">
              {tasks.slice(0, 8).map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 px-6 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[--text]">{t.title}</p>
                    <p className="mt-0.5 text-xs text-[--text-muted]">
                      {t.assigneeName ?? '—'}
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
        </Card>

        {/* Team */}
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title="الفريق المعيَّن"
              subtitle={`${assignments.length} شخص`}
            />
            <form
              action={addAssignment.bind(null, id)}
              className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr,140px,auto]"
            >
              <select
                name="profileId"
                defaultValue=""
                className="h-9 rounded-xl border border-[--line] bg-[--bg-elevated] px-2 text-sm"
              >
                <option value="">— اختر الشخص —</option>
                {activeProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
              <select
                name="role"
                required
                defaultValue=""
                className="h-9 rounded-xl border border-[--line] bg-[--bg-elevated] px-2 text-sm"
              >
                <option value="" disabled>
                  — الدور —
                </option>
                {projectAssignmentRoleEnum.enumValues.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <Button variant="primary" size="sm" icon={<Plus size={14} />}>
                إضافة
              </Button>
            </form>
          </div>
          {assignments.length === 0 ? (
            <EmptyState
              icon={<Users2 size={20} />}
              title="لم يتم تعيين فريق بعد"
              description="استخدم الفورم لإضافة أول عضو."
            />
          ) : (
            <ul className="divide-y divide-[--line]">
              {assignments.map((a) => {
                const name =
                  a.profileName ?? a.freelancerName ?? a.externalName ?? '?';
                return (
                  <li key={a.id} className="flex items-center gap-3 px-6 py-3">
                    <Avatar name={name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[--text]">
                        {name}
                      </p>
                      <p className="text-xs text-[--text-muted]">{a.role}</p>
                    </div>
                    {a.rateSar && (
                      <div className="font-mono text-xs text-[--text-dim]">
                        {Number(a.rateSar).toLocaleString('en-US')} / {a.rateUnit}
                      </div>
                    )}
                    <form action={removeAssignment.bind(null, id, a.id)}>
                      <button
                        type="submit"
                        title="إزالة"
                        className="grid h-7 w-7 place-items-center rounded-lg text-[--text-dim] hover:bg-red-500/10 hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Comments */}
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader title="التعليقات" subtitle={`${comments.length} تعليق`} />
          </div>
          <div className="px-6 pb-4">
            <form
              action={async (formData: FormData) => {
                'use server';
                const body = formData.get('body')?.toString() ?? '';
                await postComment(id, body);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                name="body"
                required
                placeholder="اكتب تعليق…"
                className="h-10 flex-1 rounded-xl border border-[--line] bg-[--bg-elevated] px-3 text-sm"
              />
              <Button variant="primary" size="md">
                إرسال
              </Button>
            </form>
          </div>
          {comments.length === 0 ? (
            <EmptyState
              icon={<MessageSquare size={20} />}
              title="ابدأ المحادثة"
              description="التعليقات هتساعد الفريق يتابع المشروع."
            />
          ) : (
            <ul className="divide-y divide-[--line] border-t border-[--line]">
              {comments.slice(0, 8).map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-6 py-3">
                  <Avatar name={c.authorName ?? '?'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-[--text-muted]">
                      <span className="font-medium text-[--text]">
                        {c.authorName ?? '?'}
                      </span>
                      <span className="font-mono text-[--text-dim]">
                        {new Date(c.createdAt)
                          .toISOString()
                          .slice(0, 16)
                          .replace('T', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[--text]">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Stage log */}
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader title="سجل المراحل" subtitle="آخر 10 انتقالات" />
          </div>
          {stageLog.length === 0 ? (
            <EmptyState
              icon={<History size={20} />}
              title="لا انتقالات بعد"
              description="سيظهر هنا تاريخ كل انتقال بين المراحل."
            />
          ) : (
            <ul className="space-y-0">
              {stageLog.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 border-t border-[--line] px-6 py-3 first:border-t-0"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <StatusPill tone={stageTone(s.fromStage ?? '')}>
                      {stageLabelAr(s.fromStage)}
                    </StatusPill>
                    <span className="text-[--text-dim]">→</span>
                    <StatusPill tone={stageTone(s.toStage)}>
                      {stageLabelAr(s.toStage)}
                    </StatusPill>
                  </div>
                  <div className="text-end text-xs text-[--text-muted]">
                    {s.changedByName ?? '?'}
                    <div className="font-mono text-[10px] text-[--text-dim]">
                      {new Date(s.changedAt).toISOString().slice(0, 10)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {contactList.length > 0 && (
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title="جهات الاتصال"
              subtitle={`${contactList.length} شخص`}
            />
          </div>
          <ul className="divide-y divide-[--line]">
            {contactList.map((c, i) => (
              <li key={i} className="flex items-center gap-3 px-6 py-3">
                <Avatar name={c.fullName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[--text]">
                    {c.fullName}
                  </p>
                  {(c.jobTitle || c.roleLabel) && (
                    <p className="text-xs text-[--text-muted]">
                      {c.jobTitle ?? ''}
                      {c.roleLabel && c.jobTitle ? ' · ' : ''}
                      {c.roleLabel ?? ''}
                    </p>
                  )}
                </div>
                <StatusPill tone="neutral">{c.side}</StatusPill>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(project.driveFolderUrl || project.notes) && (
        <Card>
          {project.driveFolderUrl && (
            <a
              href={project.driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[--accent] hover:underline"
            >
              <ExternalLink size={14} />
              Drive folder
            </a>
          )}
          {project.notes && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[--text]">
              {project.notes}
            </p>
          )}
        </Card>
      )}
    </AppShell>
  );
}

function SimpleStat({
  icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const iconBg =
    tone === 'danger'
      ? 'bg-red-500/15 text-red-400'
      : tone === 'warning'
        ? 'bg-orange-500/15 text-orange-400'
        : 'bg-[--surface-hover] text-[--text-muted]';
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[--text-dim]">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-[--text]">
            {value}
          </p>
          {sub && <p className="text-xs text-[--text-muted]">{sub}</p>}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}
