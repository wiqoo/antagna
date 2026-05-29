import { redirect } from 'next/navigation';
import { sql, eq, and, desc, asc, isNotNull } from 'drizzle-orm';
import {
  db,
  internalApprovals,
  deliverables,
  deliverableGroups,
  projects,
  profiles,
} from '@antagna/db';
import { PageHeader, Card, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getEffectiveProfileId, can } from '@/lib/authz';
import { CheckCircle2 } from 'lucide-react';
import { ApprovalsInbox, type ApprovalRow } from './ApprovalsInbox';

export const dynamic = 'force-dynamic';

const STAGE_LABEL_AR: Record<string, string> = {
  director: 'اعتماد المدير',
  account_manager: 'اعتماد مدير الحساب',
  production_manager: 'اعتماد مدير الإنتاج',
  custom: 'اعتماد',
};

export default async function ApprovalsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/approvals');

  const me = await getEffectiveProfileId();
  if (!me) redirect('/login?next=/approvals');

  const canApprove = await can('deliverable.approve');

  // Shared select shape: the approval + its deliverable / project context.
  const baseSelect = {
    id: internalApprovals.id,
    deliverableId: internalApprovals.deliverableId,
    stage: internalApprovals.stage,
    stageOrder: internalApprovals.stageOrder,
    cycleNumber: internalApprovals.cycleNumber,
    status: internalApprovals.status,
    submittedAt: internalApprovals.submittedAt,
    reviewedAt: internalApprovals.reviewedAt,
    versionReviewed: internalApprovals.versionReviewed,
    notes: internalApprovals.notes,
    revisionRequestText: internalApprovals.revisionRequestText,
    revisionRequestPriority: internalApprovals.revisionRequestPriority,
    reviewerId: internalApprovals.reviewerProfileId,
    reviewerName: profiles.displayName,
    deliverableTitle: deliverables.title,
    deliverableItemNumber: deliverables.itemNumber,
    groupNameAr: deliverableGroups.nameAr,
    projectId: projects.id,
    projectCode: projects.code,
    projectTitle: projects.title,
    projectTitleAr: projects.titleAr,
  };

  const [mine, recent] = await Promise.all([
    // بانتظار موافقتي — reviewer = effective me AND status pending.
    db
      .select(baseSelect)
      .from(internalApprovals)
      .leftJoin(deliverables, eq(deliverables.id, internalApprovals.deliverableId))
      .leftJoin(deliverableGroups, eq(deliverableGroups.id, deliverables.groupId))
      .leftJoin(projects, eq(projects.id, deliverables.projectId))
      .leftJoin(profiles, eq(profiles.id, internalApprovals.reviewerProfileId))
      .where(
        and(
          eq(internalApprovals.reviewerProfileId, me),
          eq(internalApprovals.status, 'pending'),
        ),
      )
      .orderBy(asc(internalApprovals.submittedAt))
      .limit(100),
    // Recent decisions — anything already reviewed (newest first).
    db
      .select(baseSelect)
      .from(internalApprovals)
      .leftJoin(deliverables, eq(deliverables.id, internalApprovals.deliverableId))
      .leftJoin(deliverableGroups, eq(deliverableGroups.id, deliverables.groupId))
      .leftJoin(projects, eq(projects.id, deliverables.projectId))
      .leftJoin(profiles, eq(profiles.id, internalApprovals.reviewerProfileId))
      .where(isNotNull(internalApprovals.reviewedAt))
      .orderBy(desc(internalApprovals.reviewedAt))
      .limit(30),
  ]);

  const toRow = (r: (typeof mine)[number]): ApprovalRow => ({
    id: r.id,
    deliverableId: r.deliverableId,
    stage: r.stage,
    stageLabel: STAGE_LABEL_AR[r.stage] ?? r.stage,
    cycleNumber: r.cycleNumber,
    status: r.status,
    submittedAt:
      r.submittedAt instanceof Date ? r.submittedAt.toISOString() : String(r.submittedAt ?? ''),
    reviewedAt: r.reviewedAt
      ? r.reviewedAt instanceof Date
        ? r.reviewedAt.toISOString()
        : String(r.reviewedAt)
      : null,
    versionReviewed: r.versionReviewed,
    notes: r.notes,
    revisionRequestText: r.revisionRequestText,
    reviewerName: r.reviewerName,
    deliverableTitle: r.deliverableTitle,
    deliverableItemNumber: r.deliverableItemNumber,
    groupNameAr: r.groupNameAr,
    projectId: r.projectId,
    projectCode: r.projectCode,
    projectLabel: r.projectTitleAr ?? r.projectTitle ?? null,
  });

  const pendingRows = mine.map(toRow);
  const recentRows = recent.map(toRow);

  const totalPending = pendingRows.length;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/approvals">
      <PageHeader
        eyebrow="الاعتمادات الداخلية"
        title="الاعتمادات"
        subtitle="راجع المخرجات التي تنتظر موافقتك واتخذ قرارك — اعتماد أو طلب تعديل."
      />

      <section className="space-y-5">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="section-rule" style={{ minWidth: 160 }}>
              بانتظار موافقتي
            </p>
            <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">قراراتك المطلوبة</h2>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">{totalPending} بند</span>
        </header>

        {totalPending === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 size={18} />}
              title="لا اعتمادات بانتظارك"
              description="عند إرسال مخرج للاعتماد وتعيينك مراجعًا، سيظهر هنا للموافقة أو طلب تعديل."
            />
          </Card>
        ) : (
          <ApprovalsInbox rows={pendingRows} canApprove={canApprove} />
        )}
      </section>

      <section className="space-y-5">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="section-rule" style={{ minWidth: 160 }}>
              قرارات حديثة
            </p>
            <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">آخر الاعتمادات</h2>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">{recentRows.length} قرار</span>
        </header>

        {recentRows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 size={18} />}
              title="لا قرارات سابقة"
              description="ستظهر هنا الاعتمادات والتعديلات المطلوبة بمجرد البتّ فيها."
            />
          </Card>
        ) : (
          <ApprovalsInbox rows={recentRows} canApprove={false} recent />
        )}
      </section>

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Approvals</span>
        <span>Volt Production · Jeddah</span>
      </div>
    </Shell>
  );
}
