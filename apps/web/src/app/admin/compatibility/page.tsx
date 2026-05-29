import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import {
  CompatibilityManager,
  type RuleRow,
  type ItemOption,
} from './CompatibilityManager';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function CompatibilityAdminPage() {
  await requirePermission('access.manage');

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [ruleRows, itemRows, groupRows, tagRows] = await Promise.all([
    // Each side resolves to a human label: item model > group name > tag string.
    db.execute(sql`
      SELECT
        r.id::text   AS id,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', ia.manufacturer, ia.model)), ''),
          ga.name_ar,
          CASE WHEN r.tag_a IS NOT NULL THEN '#' || r.tag_a END,
          '—'
        )            AS "sideALabel",
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', ib.manufacturer, ib.model)), ''),
          gb.name_ar,
          CASE WHEN r.tag_b IS NOT NULL THEN '#' || r.tag_b END,
          '—'
        )            AS "sideBLabel",
        r.verdict::text AS verdict,
        r.reason_ar  AS "reasonAr",
        r.reason_en  AS "reasonEn",
        r.source,
        r.verified_count AS "verifiedCount"
      FROM compatibility_rules r
      LEFT JOIN equipment ia ON ia.id = r.item_a_id
      LEFT JOIN equipment ib ON ib.id = r.item_b_id
      LEFT JOIN equipment_groups ga ON ga.id = r.group_a_id
      LEFT JOIN equipment_groups gb ON gb.id = r.group_b_id
      ORDER BY r.created_at DESC
    `),
    db.execute(sql`
      SELECT
        id::text AS id,
        NULLIF(TRIM(CONCAT_WS(' ', manufacturer, model)), '') || ' · ' || code AS label
      FROM equipment
      WHERE status <> 'retired'
      ORDER BY manufacturer, model
      LIMIT 500
    `),
    db.execute(sql`
      SELECT id::text AS id, name_ar AS label
      FROM equipment_groups
      ORDER BY name_ar
    `),
    db.execute(sql`
      SELECT key AS id, name_ar AS label
      FROM tags
      WHERE active = true
      ORDER BY name_ar
    `),
  ]);

  const ruleList = rows<RuleRow>(ruleRows);
  const items = rows<ItemOption>(itemRows);
  const groups = rows<ItemOption>(groupRows);
  // tags use the `key` string as the value stored in tag_a/tag_b.
  const tags = rows<ItemOption>(tagRows);

  return (
    <Shell user={{ email: user?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الإدارة
      </Link>

      <PageHeader
        eyebrow="Admin · Equipment"
        title="قواعد التوافق"
        subtitle="عرّف أيّ المعدات تعمل معاً (أو لا) — يعزّز اقتراحات الـ kit والتحقّق وقت الحجز."
      />

      <Card>
        <CompatibilityManager rules={ruleList} items={items} groups={groups} tags={tags} />
      </Card>
    </Shell>
  );
}
