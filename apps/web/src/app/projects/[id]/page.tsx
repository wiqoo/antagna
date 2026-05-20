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
  equipment,
  equipmentGroups,
  equipmentReservations,
  projectAssignmentRoleEnum,
} from '@antagna/db';
import {
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  MoneyDisplay,
  EmptyState,
  Avatar,
  Button,
  FileUpload,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { RealtimeComments } from '@/components/RealtimeComments';
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
import {
  addDeliverableGroup,
  addDeliverable,
  setDeliverableStatus,
  deleteDeliverable,
  addReservation,
} from './deliverables-actions';
import {
  submitForReview,
  approveDeliverable,
  requestRevisions,
} from './approval-actions';

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

  // Current actor's profile id (for highlighting their own comments)
  const [currentProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  const currentProfileId = currentProfile?.id ?? null;

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
    groupsAndItems,
    reservations,
    equipmentList,
    equipmentGroupList,
    attachmentList,
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
      db.execute<{
        group_id: string;
        group_name_ar: string;
        group_kind: string | null;
        group_position: number;
        d_id: string | null;
        d_title: string | null;
        d_item_number: string | null;
        d_status: string | null;
        d_position: number | null;
      }>(sql`
        SELECT
          dg.id::text AS group_id,
          dg.name_ar AS group_name_ar,
          dg.kind AS group_kind,
          dg.position AS group_position,
          d.id::text AS d_id,
          d.title AS d_title,
          d.item_number AS d_item_number,
          d.status::text AS d_status,
          d.position AS d_position
        FROM deliverable_groups dg
        LEFT JOIN deliverables d ON d.group_id = dg.id
        WHERE dg.project_id = ${id}::uuid
        ORDER BY dg.position, dg.created_at, d.position, d.created_at
      `),
      db
        .select({
          id: equipmentReservations.id,
          startsAt: equipmentReservations.startsAt,
          endsAt: equipmentReservations.endsAt,
          status: equipmentReservations.status,
          notes: equipmentReservations.notes,
          eqCode: equipment.code,
          eqModel: equipment.model,
          groupNameAr: equipmentGroups.nameAr,
        })
        .from(equipmentReservations)
        .leftJoin(equipment, eq(equipment.id, equipmentReservations.equipmentId))
        .leftJoin(equipmentGroups, eq(equipmentGroups.id, equipmentReservations.groupId))
        .where(eq(equipmentReservations.projectId, id))
        .orderBy(desc(equipmentReservations.startsAt)),
      db
        .select({
          id: equipment.id,
          code: equipment.code,
          model: equipment.model,
          status: equipment.status,
        })
        .from(equipment)
        .where(isNull(equipment.archivedAt))
        .orderBy(equipment.code)
        .limit(500),
      db
        .select({
          id: equipmentGroups.id,
          code: equipmentGroups.code,
          nameAr: equipmentGroups.nameAr,
        })
        .from(equipmentGroups)
        .orderBy(equipmentGroups.nameAr),
      db.execute<{
        id: string;
        filename: string;
        mime_type: string;
        size_bytes: number;
      }>(sql`
        SELECT id::text AS id, filename, mime_type, size_bytes::bigint::int AS size_bytes
        FROM attachments
        WHERE entity_type = 'project' AND entity_id = ${id}::uuid
        ORDER BY created_at DESC
      `),
    ]);

  // Group deliverables by their group
  type DGroup = {
    id: string;
    nameAr: string;
    kind: string | null;
    items: Array<{ id: string; title: string | null; itemNumber: string | null; status: string }>;
  };
  const groupedDeliverables: DGroup[] = [];
  const groupsArr = groupsAndItems as unknown as Array<{
    group_id: string;
    group_name_ar: string;
    group_kind: string | null;
    group_position: number;
    d_id: string | null;
    d_title: string | null;
    d_item_number: string | null;
    d_status: string | null;
  }>;
  for (const row of groupsArr) {
    let g = groupedDeliverables.find((x) => x.id === row.group_id);
    if (!g) {
      g = {
        id: row.group_id,
        nameAr: row.group_name_ar,
        kind: row.group_kind,
        items: [],
      };
      groupedDeliverables.push(g);
    }
    if (row.d_id) {
      g.items.push({
        id: row.d_id,
        title: row.d_title,
        itemNumber: row.d_item_number,
        status: row.d_status ?? 'draft',
      });
    }
  }

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
    <Shell user={{ email: user.email ?? '' }} activePath="/projects">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" />
        كل المشاريع
      </Link>

      {/* Hero */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -end-32 -top-32 h-80 w-80 rounded-full bg-[var(--accent)] opacity-[0.06] blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
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
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
                {project.titleAr ?? project.title}
              </h1>
              {project.titleAr && project.title && (
                <p className="text-sm text-[var(--text-muted)]">{project.title}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--text-muted)]">
                <span>
                  <span className="text-[var(--text-dim)]">العميل: </span>
                  <span className="text-[var(--text)]">
                    {project.clientNameAr}
                  </span>
                </span>
                {project.pmName && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-[var(--text-dim)]">PM:</span>
                    <Avatar name={project.pmName} size="sm" />
                    <span className="text-[var(--text)]">{project.pmName}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <Link
                href={`/projects/${id}/edit`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
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
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <Calendar size={12} />
                    تسليم:{' '}
                    <span className="font-mono text-[var(--text)]">
                      {new Date(project.deliveryDueAt).toISOString().slice(0, 10)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {project.aiStatusParagraph && (
            <div className="mt-6 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.04] p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
                <Sparkles size={12} />
                تحليل ذكي
              </div>
              <p className="text-sm leading-relaxed text-[var(--text)]">
                {project.aiStatusParagraph}
              </p>
              {project.aiNextAction && (
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  <span className="text-[var(--text-dim)]">الخطوة التالية: </span>
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
                    className="h-9 w-36 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-xs"
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
                className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm"
              />
              <select
                name="assigneeId"
                defaultValue=""
                className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm"
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
                className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm font-mono"
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
            <ul className="divide-y divide-[var(--line)]">
              {tasks.slice(0, 8).map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 px-6 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text)]">{t.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
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
                className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm"
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
                className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm"
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
            <ul className="divide-y divide-[var(--line)]">
              {assignments.map((a) => {
                const name =
                  a.profileName ?? a.freelancerName ?? a.externalName ?? '?';
                return (
                  <li key={a.id} className="flex items-center gap-3 px-6 py-3">
                    <Avatar name={name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text)]">
                        {name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{a.role}</p>
                    </div>
                    {a.rateSar && (
                      <div className="font-mono text-xs text-[var(--text-dim)]">
                        {Number(a.rateSar).toLocaleString('en-US')} / {a.rateUnit}
                      </div>
                    )}
                    <form action={removeAssignment.bind(null, id, a.id)}>
                      <button
                        type="submit"
                        title="إزالة"
                        className="grid h-7 w-7 place-items-center rounded-lg text-[var(--text-dim)] hover:bg-red-500/10 hover:text-red-400"
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
            <CardHeader
              title="التعليقات"
              subtitle={
                <>
                  {comments.length} تعليق ·{' '}
                  <span className="text-[var(--success)]">●</span> تحديث مباشر
                </>
              }
            />
          </div>
          <RealtimeComments
            projectId={id}
            currentProfileId={currentProfileId}
            postAction={async (formData: FormData) => {
              'use server';
              const body = formData.get('body')?.toString() ?? '';
              await postComment(id, body);
            }}
            initialComments={comments.map((c) => ({
              id: c.id,
              body: c.body,
              createdAt: new Date(c.createdAt).toISOString(),
              authorName: c.authorName,
              authorId: null,
            }))}
          />
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
                  className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-6 py-3 first:border-t-0"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <StatusPill tone={stageTone(s.fromStage ?? '')}>
                      {stageLabelAr(s.fromStage)}
                    </StatusPill>
                    <span className="text-[var(--text-dim)]">→</span>
                    <StatusPill tone={stageTone(s.toStage)}>
                      {stageLabelAr(s.toStage)}
                    </StatusPill>
                  </div>
                  <div className="text-end text-xs text-[var(--text-muted)]">
                    {s.changedByName ?? '?'}
                    <div className="font-mono text-[10px] text-[var(--text-dim)]">
                      {new Date(s.changedAt).toISOString().slice(0, 10)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Deliverables */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="المخرجات"
            subtitle={`${groupedDeliverables.length} مجموعة · ${groupedDeliverables.reduce((s, g) => s + g.items.length, 0)} عنصر`}
          />
          <form
            action={addDeliverableGroup.bind(null, id)}
            className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr,140px,auto]"
          >
            <input
              type="text"
              name="nameAr"
              required
              placeholder="اسم المجموعة (مثل: ريلز)"
              className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm"
            />
            <select
              name="kind"
              defaultValue=""
              className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm"
            >
              <option value="">— النوع —</option>
              <option value="reels">reels</option>
              <option value="photos">photos</option>
              <option value="print_photos">print photos</option>
              <option value="video">video</option>
              <option value="other">other</option>
            </select>
            <Button variant="primary" size="sm" icon={<Plus size={14} />}>
              مجموعة
            </Button>
          </form>
        </div>

        {groupedDeliverables.length === 0 ? (
          <EmptyState
            icon={<Package2 size={20} />}
            title="لا توجد مخرجات بعد"
            description="أضف مجموعة (مثل ريلز، صور) ثم ضيف العناصر داخلها."
          />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {groupedDeliverables.map((g) => (
              <div key={g.id} className="px-6 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text)]">
                      {g.nameAr}
                    </h3>
                    {g.kind && (
                      <StatusPill tone="neutral" withDot={false}>
                        {g.kind}
                      </StatusPill>
                    )}
                    <span className="text-xs text-[var(--text-dim)]">
                      {g.items.length} عنصر
                    </span>
                  </div>
                  <form
                    action={addDeliverable.bind(null, id)}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="groupId" value={g.id} />
                    <input
                      type="text"
                      name="itemNumber"
                      placeholder="#"
                      className="h-8 w-14 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-xs font-mono"
                    />
                    <input
                      type="text"
                      name="title"
                      placeholder="عنوان العنصر"
                      className="h-8 w-48 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <Plus size={12} />
                    </button>
                  </form>
                </div>
                {g.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-3 text-xs text-[var(--text-dim)]">
                    لا عناصر في هذه المجموعة بعد.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {g.items.map((it) => (
                      <DeliverableRow
                        key={it.id}
                        item={it}
                        projectId={id}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Equipment reservations */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="حجز معدات"
            subtitle={`${reservations.length} حجز`}
          />
          <form
            action={addReservation.bind(null, id)}
            className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr,1fr,1fr,auto]"
          >
            <select
              name="equipmentId"
              defaultValue=""
              className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm"
            >
              <option value="">— اختار معدة —</option>
              {equipmentList.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} · {e.model}
                </option>
              ))}
              <optgroup label="—— أو مجموعة ——">
                {equipmentGroupList.map((g) => (
                  <option key={`g-${g.id}`} value="" disabled>
                    استخدم الحقل التالي للمجموعات
                  </option>
                ))}
              </optgroup>
            </select>
            <input
              type="datetime-local"
              name="startsAt"
              required
              className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm font-mono"
            />
            <input
              type="datetime-local"
              name="endsAt"
              required
              className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm font-mono"
            />
            <Button variant="primary" size="sm" icon={<Plus size={14} />}>
              احجز
            </Button>
          </form>
        </div>

        {reservations.length === 0 ? (
          <EmptyState
            icon={<Package2 size={20} />}
            title="لا حجوزات بعد"
            description="احجز معدات لهذا المشروع لمنع التعارض مع المشاريع الأخرى."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {reservations.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-6 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--text)]">
                    {r.eqCode ? (
                      <>
                        <span className="font-mono text-xs text-[var(--text-dim)]">
                          {r.eqCode}
                        </span>{' '}
                        {r.eqModel}
                      </>
                    ) : (
                      <span className="italic text-[var(--text-muted)]">
                        مجموعة: {r.groupNameAr ?? '—'}
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-xs text-[var(--text-dim)]">
                    {new Date(r.startsAt).toISOString().slice(0, 16).replace('T', ' ')}
                    {' → '}
                    {new Date(r.endsAt).toISOString().slice(0, 16).replace('T', ' ')}
                  </p>
                </div>
                <StatusPill
                  tone={
                    r.status === 'checked_out'
                      ? 'warning'
                      : r.status === 'returned'
                        ? 'success'
                        : r.status === 'cancelled'
                          ? 'neutral'
                          : 'info'
                  }
                >
                  {r.status}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader
          title="الملفات المرفقة"
          subtitle={`${(attachmentList as unknown as unknown[]).length} ملف`}
        />
        <FileUpload
          entityType="project"
          entityId={id}
          initial={(attachmentList as unknown as Array<{
            id: string;
            filename: string;
            mime_type: string;
            size_bytes: number;
          }>).map((a) => ({
            id: a.id,
            filename: a.filename,
            mimeType: a.mime_type,
            sizeBytes: Number(a.size_bytes),
          }))}
        />
      </Card>

      {contactList.length > 0 && (
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title="جهات الاتصال"
              subtitle={`${contactList.length} شخص`}
            />
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {contactList.map((c, i) => (
              <li key={i} className="flex items-center gap-3 px-6 py-3">
                <Avatar name={c.fullName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text)]">
                    {c.fullName}
                  </p>
                  {(c.jobTitle || c.roleLabel) && (
                    <p className="text-xs text-[var(--text-muted)]">
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
              className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
            >
              <ExternalLink size={14} />
              Drive folder
            </a>
          )}
          {project.notes && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
              {project.notes}
            </p>
          )}
        </Card>
      )}
    </Shell>
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
        : 'bg-[var(--surface-hover)] text-[var(--text-muted)]';
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-dim)]">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            {value}
          </p>
          {sub && <p className="text-xs text-[var(--text-muted)]">{sub}</p>}
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

function DeliverableRow({
  item,
  projectId,
}: {
  item: {
    id: string;
    title: string | null;
    itemNumber: string | null;
    status: string;
  };
  projectId: string;
}) {
  const status = item.status;
  const statusTone =
    status === 'delivered'
      ? 'success'
      : status === 'cancelled'
        ? 'neutral'
        : status.startsWith('revisions')
          ? 'danger'
          : status.startsWith('pending')
            ? 'warning'
            : status === 'client_ready' || status === 'in_client_review'
              ? 'info'
              : 'neutral';

  const canSubmit = status === 'draft';
  const canApprove =
    status === 'pending_director' ||
    status === 'pending_am' ||
    status === 'client_ready' ||
    status === 'in_client_review';
  const isDone = status === 'delivered' || status === 'cancelled';

  return (
    <li className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] text-[var(--text-dim)]">
          {item.itemNumber ?? '—'}
        </span>
        <span className="flex-1 text-[13px] text-[var(--text)]">
          {item.title ?? '(بدون عنوان)'}
        </span>
        <StatusPill tone={statusTone}>
          {STATUS_LABEL_AR[status] ?? status}
        </StatusPill>

        {!isDone && (
          <div className="flex items-center gap-1">
            {canSubmit && (
              <form action={submitForReview.bind(null, projectId, item.id)}>
                <button
                  type="submit"
                  className="magnet inline-flex h-7 items-center gap-1 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)] hover:bg-[var(--accent)]/20"
                >
                  أرسل للمراجعة
                </button>
              </form>
            )}
            {canApprove && (
              <form action={approveDeliverable.bind(null, projectId, item.id)}>
                <button
                  type="submit"
                  className="magnet inline-flex h-7 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/20"
                >
                  ✓ موافقة
                </button>
              </form>
            )}
            {(canSubmit || canApprove) && (
              <details className="relative">
                <summary className="grid h-7 w-7 cursor-pointer place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] [&::-webkit-details-marker]:hidden hover:text-[var(--danger)]">
                  ↺
                </summary>
                <div className="absolute end-0 top-9 z-10 w-64 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-3 shadow-2xl">
                  <form
                    action={requestRevisions.bind(null, projectId, item.id)}
                    className="space-y-2"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                      — طلب تعديلات
                    </p>
                    <select
                      name="stage"
                      defaultValue={
                        status === 'pending_am' ? 'am' :
                        status === 'in_client_review' ? 'client' : 'director'
                      }
                      className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px]"
                    >
                      <option value="director">من المدير</option>
                      <option value="am">من الـ Account Manager</option>
                      <option value="client">من العميل</option>
                    </select>
                    <textarea
                      name="note"
                      rows={2}
                      placeholder="الملاحظة (اختياري)"
                      className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] p-2 text-[12px]"
                    />
                    <button
                      type="submit"
                      className="inline-flex h-7 w-full items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 text-[11px] font-semibold text-red-300 hover:bg-red-500/20"
                    >
                      إرسال
                    </button>
                  </form>
                </div>
              </details>
            )}
          </div>
        )}

        <form action={async (fd: FormData) => {
          'use server';
          const next = fd.get('next')?.toString();
          if (next) await setDeliverableStatus(projectId, item.id, next);
        }}>
          <select
            name="next"
            defaultValue={status}
            className="h-7 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px] text-[var(--text-muted)]"
          >
            <option value="draft">draft</option>
            <option value="submitted">submitted</option>
            <option value="pending_director">pending director</option>
            <option value="pending_am">pending AM</option>
            <option value="client_ready">client ready</option>
            <option value="in_client_review">in client review</option>
            <option value="revisions_director">revisions: director</option>
            <option value="revisions_am">revisions: AM</option>
            <option value="revisions_client">revisions: client</option>
            <option value="delivered">delivered</option>
            <option value="cancelled">cancelled</option>
          </select>
          <button
            type="submit"
            className="ms-1 inline-flex h-7 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px] hover:border-[var(--accent)]"
          >
            حفظ
          </button>
        </form>

        <form action={deleteDeliverable.bind(null, projectId, item.id)}>
          <button
            type="submit"
            title="حذف"
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-red-500/10 hover:text-red-400"
          >
            <X size={12} />
          </button>
        </form>
      </div>
    </li>
  );
}

const STATUS_LABEL_AR: Record<string, string> = {
  draft: 'مسودة',
  submitted: 'مُقدَّم',
  pending_director: 'بانتظار المدير',
  pending_am: 'بانتظار AM',
  revisions_director: 'تعديلات المدير',
  revisions_am: 'تعديلات AM',
  client_ready: 'جاهز للعميل',
  in_client_review: 'لدى العميل',
  revisions_client: 'تعديلات العميل',
  delivered: 'مُسلَّم',
  cancelled: 'مُلغى',
};
