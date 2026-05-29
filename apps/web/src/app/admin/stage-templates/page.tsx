import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { StageTemplatesBuilder, type TemplateRow } from './StageTemplatesBuilder';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function StageTemplatesAdminPage() {
  await requirePermission('access.manage');

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tplRows = await db.execute(sql`
    SELECT
      id::text             AS id,
      stage::text          AS stage,
      title_ar             AS "titleAr",
      title_en             AS "titleEn",
      description,
      assignee_role_hint::text AS "assigneeRoleHint",
      due_offset_days      AS "dueOffsetDays",
      is_mandatory         AS "isMandatory",
      position,
      active
    FROM stage_task_templates
    ORDER BY stage, position
  `);

  const templates = rows<TemplateRow>(tplRows);

  return (
    <Shell user={{ email: user?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الإدارة
      </Link>

      <PageHeader
        eyebrow="Admin · Lifecycle"
        title="قوالب مهام المراحل"
        subtitle="عرّف قائمة المهام التي تُنشأ تلقائياً لكل مرحلة من مراحل المشروع — مرتّبة وقابلة للتفعيل/التعطيل."
      />

      <Card>
        <StageTemplatesBuilder templates={templates} />
      </Card>
    </Shell>
  );
}
