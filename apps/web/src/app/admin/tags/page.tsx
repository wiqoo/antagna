import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { TagsManager, type TagRow } from './TagsManager';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function TagsAdminPage() {
  await requirePermission('access.manage');

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tagRows = await db.execute(sql`
    SELECT
      t.id::text          AS id,
      t.key,
      t.name_ar           AS "nameAr",
      t.name_en           AS "nameEn",
      t.color,
      t.category,
      t.scope_entity_type AS "scopeEntityType",
      t.active,
      (SELECT count(*)::int FROM tag_assignments a WHERE a.tag_id = t.id) AS "usageCount"
    FROM tags t
    ORDER BY t.category NULLS LAST, t.name_ar
  `);

  const tags = rows<TagRow>(tagRows);

  return (
    <Shell user={{ email: user?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الإدارة
      </Link>

      <PageHeader
        eyebrow="Admin · Taxonomy"
        title="الوسوم"
        subtitle="صنّف المشاريع والعملاء والمعدات عبر وسوم موحّدة — مع عدّاد الاستخدام لكل وسم."
      />

      <Card>
        <TagsManager tags={tags} />
      </Card>
    </Shell>
  );
}
