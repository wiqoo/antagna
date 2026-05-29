import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, StatBox, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Gauge, Users, FolderKanban, AlertTriangle } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { UtilizationHeatmap, type UtilRow } from './UtilizationHeatmap';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

// Stages that count as "active load" for a person. Lead/quoted aren't staffed
// yet; delivered/archived/lost/cancelled are done. Mirrors PROJECT_STAGE_ORDER
// minus the bookends.
const ACTIVE_STAGES = ['approved', 'planning', 'shooting', 'editing', 'review'];

export default async function TeamUtilizationPage() {
  await requirePermission('access.manage');

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Per-person active-project load. We count DISTINCT active projects a person
  // is assigned to (via project_assignments) PLUS the manager seats on the
  // project row itself (account/project/production manager), so a PM with no
  // explicit assignment row still shows load. archived people excluded.
  const utilRows = await db.execute(sql`
    WITH active_projects AS (
      SELECT id FROM projects
      WHERE stage = ANY(ARRAY[${sql.join(
        ACTIVE_STAGES.map((s) => sql`${s}`),
        sql`, `,
      )}]::project_stage[])
    ),
    person_load AS (
      -- explicit crew assignments
      SELECT pa.profile_id AS profile_id, pa.project_id AS project_id
      FROM project_assignments pa
      JOIN active_projects ap ON ap.id = pa.project_id
      WHERE pa.profile_id IS NOT NULL
      UNION
      -- manager seats on the project spine
      SELECT p.account_manager_id, p.id FROM projects p
      JOIN active_projects ap ON ap.id = p.id
      WHERE p.account_manager_id IS NOT NULL
      UNION
      SELECT p.project_manager_id, p.id FROM projects p
      JOIN active_projects ap ON ap.id = p.id
      WHERE p.project_manager_id IS NOT NULL
      UNION
      SELECT p.production_manager_id, p.id FROM projects p
      JOIN active_projects ap ON ap.id = p.id
      WHERE p.production_manager_id IS NOT NULL
    )
    SELECT
      pr.id::text                          AS id,
      pr.display_name                      AS "displayName",
      pr.position_key                      AS "positionKey",
      COALESCE(pos.name_ar, pr.position_key) AS "positionNameAr",
      d.name_ar                            AS "departmentNameAr",
      COUNT(DISTINCT pl.project_id)::int   AS "activeProjects"
    FROM profiles pr
    LEFT JOIN person_load pl ON pl.profile_id = pr.id
    LEFT JOIN positions pos ON pos.key = pr.position_key
    LEFT JOIN departments d ON d.id = pr.department_id
    WHERE pr.archived_at IS NULL
      AND pr.status <> 'terminated'
    GROUP BY pr.id, pr.display_name, pr.position_key, pos.name_ar, d.name_ar
    ORDER BY COUNT(DISTINCT pl.project_id) DESC, pr.display_name
  `);

  const people = rows<UtilRow>(utilRows);

  const totalActiveRow = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM projects
    WHERE stage = ANY(ARRAY[${sql.join(
      ACTIVE_STAGES.map((s) => sql`${s}`),
      sql`, `,
    )}]::project_stage[])
  `);
  const activeProjectCount = (rows<{ count: number }>(totalActiveRow)[0]?.count) ?? 0;

  const staffed = people.filter((p) => p.activeProjects > 0);
  const idle = people.length - staffed.length;
  // Soft capacity heuristic: 3 concurrent active projects is the comfortable
  // ceiling for one person. Above that flags overload (no contract data yet).
  const CAP = 3;
  const overloaded = people.filter((p) => p.activeProjects > CAP).length;
  const totalLoad = people.reduce((s, p) => s + p.activeProjects, 0);
  const avgLoad = people.length ? totalLoad / people.length : 0;

  return (
    <Shell user={{ email: user?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الإدارة
      </Link>

      <PageHeader
        eyebrow="Admin · الفريق"
        title="حِمل الفريق"
        subtitle="عدد المشاريع النشطة لكل فرد مقابل سعته — خريطة حرارية للتوزيع. السقف المريح 3 مشاريع متزامنة."
      />

      {people.length === 0 ? (
        <EmptyState
          icon={<Users size={20} />}
          title="لا أعضاء فريق بعد"
          description="أضف أعضاء الفريق عبر دعوة مستخدم، ثم أسندهم للمشاريع لتظهر خريطة الحِمل."
          action={
            <Link
              href="/admin/invite-user"
              className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              دعوة مستخدم
            </Link>
          }
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatBox
              label="مشاريع نشطة"
              value={activeProjectCount}
              icon={<FolderKanban size={16} />}
            />
            <StatBox
              label="مُسنَدون"
              value={staffed.length}
              sub={`${idle} بلا حِمل`}
              icon={<Users size={16} />}
              tone={staffed.length > 0 ? 'success' : 'default'}
            />
            <StatBox
              label="متوسط الحِمل"
              value={0}
              format={avgLoad.toFixed(1)}
              sub="مشروع / فرد"
              icon={<Gauge size={16} />}
            />
            <StatBox
              label="فوق السعة"
              value={overloaded}
              sub={`أكثر من ${CAP} مشاريع`}
              icon={<AlertTriangle size={16} />}
              tone={overloaded > 0 ? 'danger' : 'success'}
            />
          </section>

          <UtilizationHeatmap people={people} cap={CAP} />
        </>
      )}
    </Shell>
  );
}
