import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { desc, eq, sql, and, isNull } from 'drizzle-orm';
import {
  db,
  projectStagesLog,
  projectAssignments,
  projectTasks,
  projectComments,
  contacts,
  profiles,
  freelancers,
  deliverables,
  deliverableGroups,
  equipment,
  equipmentGroups,
  equipmentReservations,
  projectAssignmentRoleEnum,
  withProfileScope,
  vProjectsSafe,
  vClientsSafe,
  vTeamSafe,
} from '@antagna/db';
import {
  PageHeader,
  AIHints,
  type AIHint,
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
import { getEffectiveProfileId, requirePermission } from '@/lib/authz';
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
  LayoutGrid,
  Repeat2,
  CheckCircle2,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { stageTone, stageLabelAr } from '@/lib/project-stage';
import { postComment } from './actions';
import { StagePanel } from './stage-panel';
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
import { startRevision, resolveRevision } from './revision-actions';

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

  // Read gate (granular RBAC). Lacking project.read → redirect to /dashboard.
  await requirePermission('project.read');

  const activeProfiles = await db
    .select({ id: profiles.id, displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.status, 'active'))
    .orderBy(profiles.displayName);

  const freelancersList = (await db.execute(sql`
    SELECT id::text AS id, COALESCE(full_name_ar, full_name) AS name
    FROM freelancers WHERE archived_at IS NULL AND active
    ORDER BY preferred DESC, full_name LIMIT 200
  `)) as unknown as { id: string; name: string }[];

  // Current actor's profile id (for highlighting their own comments)
  const [currentProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  const currentProfileId = currentProfile?.id ?? null;

  // Per-user masked read: the GUC set by withProfileScope makes v_projects_safe
  // (and the joined v_clients_safe / v_team_safe) redact financial / internal
  // columns for the effective profile (view-as aware). This is the ONLY masked
  // read on the page — the aux reads below (tasks, comments, stage-log,
  // reservations, deliverables, activity, attachments) stay on base tables.
  // Keep it a SINGLE withProfileScope (no nesting) to avoid pooled-connection
  // contention. WRITES (server actions) untouched and run on base tables.
  const pid = await getEffectiveProfileId();
  const [project] = await withProfileScope(pid, (tx) =>
    tx
      .select({
        id: vProjectsSafe.id,
        code: vProjectsSafe.code,
        title: vProjectsSafe.title,
        titleAr: vProjectsSafe.titleAr,
        description: vProjectsSafe.description,
        stage: vProjectsSafe.stage,
        projectType: vProjectsSafe.projectType,
        contractedValueSar: vProjectsSafe.contractedValueSar,
        briefReceivedAt: vProjectsSafe.briefReceivedAt,
        quotedAt: vProjectsSafe.quotedAt,
        approvedAt: vProjectsSafe.approvedAt,
        shootStartsAt: vProjectsSafe.shootStartsAt,
        shootEndsAt: vProjectsSafe.shootEndsAt,
        deliveryDueAt: vProjectsSafe.deliveryDueAt,
        deliveredAt: vProjectsSafe.deliveredAt,
        archivedAt: vProjectsSafe.archivedAt,
        aiStatusParagraph: vProjectsSafe.aiStatusParagraph,
        aiRiskLevel: vProjectsSafe.aiRiskLevel,
        aiNextAction: vProjectsSafe.aiNextAction,
        aiAnalyzedAt: vProjectsSafe.aiAnalyzedAt,
        driveFolderUrl: vProjectsSafe.driveFolderUrl,
        notes: vProjectsSafe.notes,
        isAbuLukaContent: vProjectsSafe.isAbuLukaContent,
        clientId: vProjectsSafe.clientId,
        clientCode: vClientsSafe.code,
        clientNameAr: vClientsSafe.nameAr,
        clientNameEn: vClientsSafe.nameEn,
        pmName: vTeamSafe.displayName,
      })
      .from(vProjectsSafe)
      .leftJoin(vClientsSafe, eq(vClientsSafe.id, vProjectsSafe.clientId))
      .leftJoin(vTeamSafe, eq(vTeamSafe.id, vProjectsSafe.projectManagerId))
      .where(eq(vProjectsSafe.id, id))
      .limit(1),
  );

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
    ,
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

  // Revision rounds (feedback cycles) + their change-request items, newest round first.
  const revisionRows = (await db.execute(sql`
    SELECT
      rr.id::text AS round_id,
      rr.round_number AS round_number,
      rr.started_at AS started_at,
      rr.resolved_at AS resolved_at,
      rr.summary AS summary,
      rr.client_feedback AS client_feedback,
      p.display_name AS initiated_by,
      ri.id::text AS item_id,
      ri.item_number AS item_number,
      ri.change_request AS change_request,
      ri.status AS item_status
    FROM revision_rounds rr
    LEFT JOIN profiles p ON p.id = rr.initiated_by_id
    LEFT JOIN revision_items ri ON ri.round_id = rr.id
    WHERE rr.project_id = ${id}::uuid
    ORDER BY rr.round_number DESC, ri.item_number NULLS LAST, ri.id
  `)) as unknown as Array<{
    round_id: string;
    round_number: number;
    started_at: string;
    resolved_at: string | null;
    summary: string | null;
    client_feedback: string | null;
    initiated_by: string | null;
    item_id: string | null;
    item_number: string | null;
    change_request: string | null;
    item_status: string | null;
  }>;

  type RevRound = {
    id: string;
    roundNumber: number;
    startedAt: string;
    resolvedAt: string | null;
    summary: string | null;
    clientFeedback: string | null;
    initiatedBy: string | null;
    items: Array<{
      id: string;
      itemNumber: string | null;
      changeRequest: string | null;
      status: string;
    }>;
  };
  const revisionRounds: RevRound[] = [];
  for (const row of revisionRows) {
    let r = revisionRounds.find((x) => x.id === row.round_id);
    if (!r) {
      r = {
        id: row.round_id,
        roundNumber: Number(row.round_number),
        startedAt: row.started_at,
        resolvedAt: row.resolved_at,
        summary: row.summary,
        clientFeedback: row.client_feedback,
        initiatedBy: row.initiated_by,
        items: [],
      };
      revisionRounds.push(r);
    }
    if (row.item_id) {
      r.items.push({
        id: row.item_id,
        itemNumber: row.item_number,
        changeRequest: row.change_request,
        status: row.item_status ?? 'open',
      });
    }
  }

  // Activity timeline — the company-memory feed (write_activity), newest first.
  const activity = (await db.execute(sql`
    SELECT a.action AS action, a.summary_ar AS summary,
           a.created_at AS at, p.display_name AS actor
    FROM activity_events a
    LEFT JOIN profiles p ON p.id = a.actor_id
    WHERE a.project_id = ${id}::uuid
    ORDER BY a.created_at DESC
    LIMIT 30
  `)) as unknown as Array<{
    action: string;
    summary: string | null;
    at: string;
    actor: string | null;
  }>;

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

  const nextStages = project.stage ? STAGE_TRANSITIONS[project.stage] ?? [] : [];

  // Stage-panel data (relative dates computed server-side → hydration-safe).
  const arRel = (d: Date | string | null | undefined): string => {
    if (!d) return '';
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days <= 0) return 'اليوم';
    if (days === 1) return 'أمس';
    if (days < 7) return `منذ ${days} أيام`;
    const w = Math.floor(days / 7);
    if (w < 5) return `منذ ${w} ${w === 1 ? 'أسبوع' : 'أسابيع'}`;
    const m = Math.floor(days / 30);
    return `منذ ${m} ${m === 1 ? 'شهر' : 'أشهر'}`;
  };
  const stageEnteredAt = stageLog.find((l) => l.toStage === project.stage)?.changedAt ?? null;
  const inStageLabel = stageEnteredAt ? arRel(stageEnteredAt) : null;
  const stageHistory = stageLog.slice(0, 5).map((l) => ({
    fromLabel: l.fromStage ? stageLabelAr(l.fromStage) : null,
    toLabel: stageLabelAr(l.toStage),
    byName: l.changedByName ?? null,
    whenLabel: arRel(l.changedAt),
    reason: l.reason ?? null,
  }));

  // ── Page-level AI hints (derived from data already loaded) ────────────────
  const now = new Date();
  const overdueDays = project.deliveryDueAt
    ? Math.floor((now.getTime() - new Date(project.deliveryDueAt).getTime()) / 86_400_000)
    : null;
  const closeDeadline = overdueDays != null && overdueDays >= -3 && overdueDays < 0;
  const isOverdue = overdueDays != null && overdueDays > 0;
  const overdueTasks = openTasks.filter(
    (t) => t.dueAt && new Date(t.dueAt) < now,
  );
  const pendingReview = delivStats.find((s) => s.status === 'pending_director')?.count ?? 0;
  const inClientReview = delivStats.find((s) => s.status === 'in_client_review')?.count ?? 0;
  const lastUpdate = comments[0]?.createdAt
    ? Math.floor((now.getTime() - new Date(comments[0].createdAt).getTime()) / 86_400_000)
    : null;

  const pageHints: AIHint[] = [];
  if (isOverdue) {
    pageHints.push({
      index: String(pageHints.length + 1).padStart(2, '0'),
      text: `موعد التسليم متأخر بـ ${overdueDays} يوم`,
      insight: 'فاوض العميل على موعد جديد أو سرّع الـ deliverables.',
      urgent: true,
    });
  } else if (closeDeadline) {
    pageHints.push({
      index: String(pageHints.length + 1).padStart(2, '0'),
      text: `${Math.abs(overdueDays!)} أيام فقط حتى التسليم`,
      insight: 'تحقق من تقدّم المهام و الـ deliverables المتبقية.',
      urgent: true,
    });
  }
  if (blockedTasks.length > 0) {
    pageHints.push({
      index: String(pageHints.length + 1).padStart(2, '0'),
      text: `${blockedTasks.length} مهمة موقوفة (blocked)`,
      insight: 'حدد السبب أو وزّعها على شخص قادر على إكمالها.',
      urgent: true,
    });
  }
  if (overdueTasks.length > 0 && pageHints.length < 3) {
    pageHints.push({
      index: String(pageHints.length + 1).padStart(2, '0'),
      text: `${overdueTasks.length} مهمة تأخر موعدها`,
      insight: 'حدّث الحالة أو غيّر التاريخ.',
    });
  }
  if (pendingReview > 0 && pageHints.length < 3) {
    pageHints.push({
      index: String(pageHints.length + 1).padStart(2, '0'),
      text: `${pendingReview} مخرج بانتظار مراجعتك`,
      insight: 'راجع و وافق أو اطلب تعديلات قبل أن يتأخر العميل.',
    });
  }
  if (inClientReview > 0 && pageHints.length < 3) {
    pageHints.push({
      index: String(pageHints.length + 1).padStart(2, '0'),
      text: `${inClientReview} مخرج عند العميل للمراجعة`,
      insight: 'تابع العميل إذا تجاوز ٤٨ ساعة بدون رد.',
    });
  }
  if (lastUpdate != null && lastUpdate >= 5 && pageHints.length < 3) {
    pageHints.push({
      index: String(pageHints.length + 1).padStart(2, '0'),
      text: `لا حركة على المشروع منذ ${lastUpdate} يوم`,
      insight: 'تواصل مع المسؤول أو حدّث الحالة لتجنّب التوقف.',
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/projects">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" />
        كل المشاريع
      </Link>

      {pageHints.length > 0 && (
        <AIHints
          context={`Antagna AI · ${project.code}`}
          headline={`${pageHints.length} ${pageHints.length === 1 ? 'تنبيه' : 'تنبيهات'} على هذا المشروع`}
          hints={pageHints}
          compact
        />
      )}

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
                    انتباه: {project.aiRiskLevel === 'red' ? 'عالٍ' : project.aiRiskLevel === 'amber' ? 'متوسط' : 'منخفض'}
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
                  {project.clientNameAr ? (
                    <span className="text-[var(--text)]">
                      {project.clientNameAr}
                    </span>
                  ) : project.isAbuLukaContent ? (
                    <span className="inline-flex items-center rounded-md bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                      محتوى أبو لوكا
                    </span>
                  ) : (
                    <span className="text-[var(--text-dim)]">—</span>
                  )}
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
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
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

          <div className="mt-6 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/[0.04] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
                <Sparkles size={12} />
                تحليل ذكي
                {project.aiAnalyzedAt && (
                  <span className="font-mono text-[10px] text-[var(--text-dim)]">
                    · {new Date(project.aiAnalyzedAt).toISOString().slice(0, 10)}
                  </span>
                )}
              </div>
              <form
                action={async () => {
                  'use server';
                  const { reanalyzeProject } = await import('./ai-actions');
                  await reanalyzeProject(id, true);
                }}
              >
                <button
                  type="submit"
                  className="magnet inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)] hover:bg-[var(--accent)]/20"
                >
                  <Sparkles size={10} />
                  حلّل من جديد
                </button>
              </form>
            </div>
            {project.aiStatusParagraph ? (
              <>
                <p className="text-sm leading-relaxed text-[var(--text)]">
                  {project.aiStatusParagraph}
                </p>
                {project.aiNextAction && (
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    <span className="text-[var(--text-dim)]">الخطوة التالية: </span>
                    {project.aiNextAction}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                لم يتم تحليل المشروع بعد. اضغط "حلّل من جديد" لتشغيل Claude.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Project pipeline + stage control + history */}
      {project.stage && (
        <Card>
          <CardHeader
            title="مسار المشروع"
            subtitle="موضع المشروع في المسار، التحكّم في المرحلة، وسجل التغييرات"
          />
          <StagePanel
            projectId={id}
            currentStage={project.stage}
            nextStages={nextStages}
            inStageLabel={inStageLabel}
            history={stageHistory}
          />
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
            <div className="flex items-start justify-between gap-3">
              <CardHeader
                title="المهام"
                subtitle={`${tasks.length} مهمة في المجموع`}
              />
              <Link
                href={`/projects/${id}/board`}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
              >
                <LayoutGrid size={13} />
                لوحة كانبان
              </Link>
            </div>
            <form
              action={addProjectTask.bind(null, id)}
              className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_120px_auto]"
            >
              <input
                type="text"
                name="title"
                required
                placeholder="مهمة جديدة…"
                className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm"
              />
              <select
                name="assigneeId"
                defaultValue=""
                className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm"
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
                className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm font-mono"
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
              description="أضف مهام من النموذج الذي فوق."
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
              className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_auto]"
            >
              <select
                name="assignee"
                defaultValue=""
                className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm"
              >
                <option value="">— اختر الشخص —</option>
                <optgroup label="الفريق">
                  {activeProfiles.map((p) => (
                    <option key={p.id} value={`p:${p.id}`}>
                      {p.displayName}
                    </option>
                  ))}
                </optgroup>
                {freelancersList.length > 0 && (
                  <optgroup label="فريلانسرز">
                    {freelancersList.map((f) => (
                      <option key={f.id} value={`f:${f.id}`}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <select
                name="role"
                required
                defaultValue=""
                className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm"
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
              description="استخدم النموذج لإضافة أول عضو."
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

      {/* Activity timeline — the write_activity feed (also powers the AI memory) */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader title="النشاط" subtitle="آخر التحديثات على المشروع" />
        </div>
        {activity.length === 0 ? (
          <EmptyState
            icon={<History size={20} />}
            title="لا نشاط بعد"
            description="ستظهر هنا التغييرات والتعليقات والاعتمادات أولاً بأول."
          />
        ) : (
          <ul className="space-y-0">
            {activity.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-3 border-t border-[var(--line)] px-6 py-3 first:border-t-0"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--text)]">{a.summary ?? a.action}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-dim)]">
                    <span className="font-mono">{a.action}</span>
                    {a.actor && (
                      <>
                        <span>·</span>
                        <span>{a.actor}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="font-mono">
                      {new Date(a.at).toISOString().slice(0, 16).replace('T', ' ')}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Revisions — feedback rounds (revision_rounds + revision_items) */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="المراجعات"
            subtitle={
              revisionRounds.length
                ? `${revisionRounds.length} جولة · ${revisionRounds.filter((r) => !r.resolvedAt).length} مفتوحة`
                : 'جولات التعديل والملاحظات'
            }
          />
          <form
            action={startRevision.bind(null, id)}
            className="mt-3 space-y-2"
          >
            <input
              type="text"
              name="clientFeedback"
              placeholder="ملاحظة العميل / سبب الجولة (اختياري)"
              className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm"
            />
            <textarea
              name="items"
              rows={2}
              placeholder="التغييرات المطلوبة — سطر لكل تغيير (اختياري)"
              className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-2.5 text-sm"
            />
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                icon={<Repeat2 size={14} />}
              >
                ابدأ جولة مراجعة
              </Button>
            </div>
          </form>
        </div>

        {revisionRounds.length === 0 ? (
          <EmptyState
            icon={<Repeat2 size={20} />}
            title="لا جولات مراجعة بعد"
            description="ابدأ جولة عند ورود ملاحظات من المدير أو العميل لتتبّع التغييرات المطلوبة."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {revisionRounds.map((r) => {
              const openItems = r.items.filter((i) => i.status === 'open').length;
              const isResolved = !!r.resolvedAt;
              return (
                <li key={r.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-[var(--text-dim)]">
                          جولة #{r.roundNumber}
                        </span>
                        <StatusPill tone={isResolved ? 'success' : 'warning'}>
                          {isResolved ? 'مُغلقة' : 'مفتوحة'}
                        </StatusPill>
                        {r.items.length > 0 && (
                          <span className="text-xs text-[var(--text-dim)]">
                            {r.items.length} تغيير
                            {!isResolved && openItems > 0
                              ? ` · ${openItems} مفتوح`
                              : ''}
                          </span>
                        )}
                      </div>
                      {r.clientFeedback && (
                        <p className="text-sm leading-relaxed text-[var(--text)]">
                          {r.clientFeedback}
                        </p>
                      )}
                      {r.summary && (
                        <p className="text-xs text-[var(--text-muted)]">
                          {r.summary}
                        </p>
                      )}
                      <p className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-dim)]">
                        {r.initiatedBy && <span>{r.initiatedBy}</span>}
                        <span>·</span>
                        <span className="font-mono">
                          {new Date(r.startedAt).toISOString().slice(0, 10)}
                        </span>
                        {r.resolvedAt && (
                          <>
                            <span>· أُغلقت</span>
                            <span className="font-mono">
                              {new Date(r.resolvedAt).toISOString().slice(0, 10)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    {!isResolved && (
                      <form action={resolveRevision.bind(null, id, r.id)}>
                        <button
                          type="submit"
                          className="magnet inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                        >
                          <CheckCircle2 size={13} />
                          إغلاق الجولة
                        </button>
                      </form>
                    )}
                  </div>

                  {r.items.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {r.items.map((it) => (
                        <li
                          key={it.id}
                          className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 px-3 py-2"
                        >
                          {it.itemNumber && (
                            <span className="font-mono text-[11px] text-[var(--text-dim)]">
                              {it.itemNumber}
                            </span>
                          )}
                          <span className="flex-1 text-[13px] text-[var(--text)]">
                            {it.changeRequest ?? '—'}
                          </span>
                          <StatusPill
                            tone={
                              it.status === 'done'
                                ? 'success'
                                : it.status === 'cancelled'
                                  ? 'neutral'
                                  : 'warning'
                            }
                          >
                            {it.status === 'done'
                              ? 'تم'
                              : it.status === 'cancelled'
                                ? 'مُلغى'
                                : 'مفتوح'}
                          </StatusPill>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Frame.io-style 2-stage approval pipeline */}
      {groupedDeliverables.reduce((s, g) => s + g.items.length, 0) > 0 && (
        <Card>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                — Approval Pipeline · Frame.io style
              </p>
              <h2 className="mt-2 text-base font-semibold text-[var(--text)]">
                حالة المراجعة عبر المراحل
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Internal QC column */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                مراجعة داخلية
              </p>
              <PipelineStage
                label="مسودة"
                tone="neutral"
                count={groupedDeliverables.reduce(
                  (s, g) => s + g.items.filter((i) => i.status === 'draft').length,
                  0,
                )}
              />
              <PipelineStage
                label="بانتظار المدير"
                tone="warning"
                count={groupedDeliverables.reduce(
                  (s, g) => s + g.items.filter((i) => i.status === 'pending_director').length,
                  0,
                )}
              />
              <PipelineStage
                label="بانتظار AM"
                tone="warning"
                count={groupedDeliverables.reduce(
                  (s, g) => s + g.items.filter((i) => i.status === 'pending_am').length,
                  0,
                )}
              />
              <PipelineStage
                label="تعديلات داخلية"
                tone="danger"
                count={groupedDeliverables.reduce(
                  (s, g) =>
                    s +
                    g.items.filter(
                      (i) => i.status === 'revisions_director' || i.status === 'revisions_am',
                    ).length,
                  0,
                )}
              />
            </div>

            {/* Client column */}
            <div className="space-y-2 border-s border-[var(--line)] ps-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                مراجعة العميل
              </p>
              <PipelineStage
                label="جاهز للعميل"
                tone="accent"
                count={groupedDeliverables.reduce(
                  (s, g) => s + g.items.filter((i) => i.status === 'client_ready').length,
                  0,
                )}
              />
              <PipelineStage
                label="لدى العميل"
                tone="info"
                count={groupedDeliverables.reduce(
                  (s, g) => s + g.items.filter((i) => i.status === 'in_client_review').length,
                  0,
                )}
              />
              <PipelineStage
                label="تعديلات العميل"
                tone="danger"
                count={groupedDeliverables.reduce(
                  (s, g) => s + g.items.filter((i) => i.status === 'revisions_client').length,
                  0,
                )}
              />
              <PipelineStage
                label="مُسلَّم"
                tone="success"
                count={groupedDeliverables.reduce(
                  (s, g) => s + g.items.filter((i) => i.status === 'delivered').length,
                  0,
                )}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Deliverables */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="المخرجات"
            subtitle={`${groupedDeliverables.length} مجموعة · ${groupedDeliverables.reduce((s, g) => s + g.items.length, 0)} عنصر`}
          />
          <form
            action={addDeliverableGroup.bind(null, id)}
            className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_auto]"
          >
            <input
              type="text"
              name="nameAr"
              required
              placeholder="اسم المجموعة (مثل: ريلز)"
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm"
            />
            <select
              name="kind"
              defaultValue=""
              className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-sm"
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
            description="أضف مجموعة (مثل ريلز، صور) ثم أضف العناصر داخلها."
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
                  <p className="rounded-md border border-dashed border-[var(--line)] px-4 py-3 text-xs text-[var(--text-dim)]">
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
          className={`flex h-10 w-10 items-center justify-center rounded-md ${iconBg}`}
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

function PipelineStage({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'neutral' | 'warning' | 'danger' | 'success' | 'info' | 'accent';
}) {
  const TONE: Record<string, string> = {
    neutral: 'border-[var(--line)] text-[var(--text-muted)]',
    warning: 'border-[var(--warning)]/40 bg-[var(--warning)]/[0.04] text-[var(--warning)]',
    danger:  'border-[var(--danger)]/40 bg-[var(--danger)]/[0.04] text-[var(--danger)]',
    success: 'border-[var(--success)]/40 bg-[var(--success)]/[0.04] text-[var(--success)]',
    info:    'border-[var(--info)]/40 bg-[var(--info)]/[0.04] text-[var(--info)]',
    accent:  'border-[var(--accent)]/40 bg-[var(--accent)]/[0.04] text-[var(--accent)]',
  };
  return (
    <div
      className={
        'flex items-center justify-between rounded-md border px-3 py-2 ' +
        (count === 0 ? 'border-[var(--line)]/50 opacity-50' : TONE[tone] ?? TONE.neutral)
      }
    >
      <span className="text-[12px]">{label}</span>
      <span className="font-mono text-[16px] font-bold tabular">{count}</span>
    </div>
  );
}
