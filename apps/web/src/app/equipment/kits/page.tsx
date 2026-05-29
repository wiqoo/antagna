import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, StatBox, AIHints, type AIHint } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Boxes, Package, CheckSquare, Layers } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can } from '@/lib/authz';
import { KitBuilder } from './KitBuilder';
import type {
  SetupRow,
  SetupItemRow,
  EqOption,
  GroupOption,
  CompatPair,
  SuggestionRow,
} from './KitBuilder';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function KitsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/equipment/kits');

  const canEdit = await can('equipment.update');

  const [setupR, itemR, eqR, grpR, compatR, suggR] = await Promise.all([
    // Setups (kits) + their primary item label/category/group.
    db.execute(sql`
      SELECT k.id::text AS id, k.code, k.name_ar AS "nameAr", k.name_en AS "nameEn",
             k.description, k.active,
             k.primary_equipment_id::text AS "primaryEquipmentId",
             e.code AS "primaryCode", e.model AS "primaryModel",
             e.manufacturer AS "primaryManufacturer", e.category AS "primaryCategory",
             e.group_id::text AS "primaryGroupId"
      FROM kits k
      LEFT JOIN equipment e ON e.id = k.primary_equipment_id
      ORDER BY k.active DESC, k.code`),
    // Items inside each setup (item OR group), with labels for both.
    db.execute(sql`
      SELECT ki.id::text AS id, ki.kit_id::text AS "kitId",
             ki.equipment_id::text AS "equipmentId",
             ki.equipment_group_id::text AS "equipmentGroupId",
             ki.quantity, ki.is_mandatory AS "isMandatory",
             ki.position, ki.notes,
             e.code AS "eqCode", e.model AS "eqModel",
             e.manufacturer AS "eqManufacturer", e.category AS "eqCategory",
             g.name_ar AS "groupNameAr", g.category AS "groupCategory"
      FROM kit_items ki
      LEFT JOIN equipment e ON e.id = ki.equipment_id
      LEFT JOIN equipment_groups g ON g.id = ki.equipment_group_id
      ORDER BY ki.kit_id, ki.is_mandatory DESC, ki.position NULLS LAST`),
    // Bookable units (exclude archived + retired) to add to a setup.
    db.execute(sql`
      SELECT e.id::text AS id, e.code, e.model, e.manufacturer, e.category,
             e.group_id::text AS "groupId", e.status::text AS status
      FROM equipment e
      WHERE e.archived_at IS NULL AND e.status <> 'retired'::equipment_status
      ORDER BY e.category, e.code
      LIMIT 500`),
    // Groups (for adding a "any unit of group X" line).
    db.execute(sql`
      SELECT id::text AS id, code, name_ar AS "nameAr", category
      FROM equipment_groups
      ORDER BY name_ar`),
    // Verified-compatible pairs (item↔item and group↔group), to highlight
    // good companions when a primary is chosen.
    db.execute(sql`
      SELECT
        item_a_id::text  AS "itemAId",
        item_b_id::text  AS "itemBId",
        group_a_id::text AS "groupAId",
        group_b_id::text AS "groupBId",
        verdict::text    AS verdict,
        reason_ar        AS "reasonAr",
        verified_count   AS "verifiedCount"
      FROM compatibility_rules
      WHERE verdict <> 'unverified'
      ORDER BY verified_count DESC
      LIMIT 1000`),
    // AI / learned kit suggestions keyed by primary GROUP.
    db.execute(sql`
      SELECT
        ks.id::text AS id,
        ks.primary_equipment_group_id::text AS "primaryGroupId",
        ks.suggested_item_group_id::text    AS "suggestedItemGroupId",
        ks.suggested_item_id::text          AS "suggestedItemId",
        ks.quantity, ks.importance, ks.reason_ar AS "reasonAr",
        sg.name_ar AS "suggestedGroupNameAr",
        se.code AS "suggestedItemCode", se.model AS "suggestedItemModel"
      FROM kit_suggestions ks
      LEFT JOIN equipment_groups sg ON sg.id = ks.suggested_item_group_id
      LEFT JOIN equipment se ON se.id = ks.suggested_item_id
      ORDER BY ks.position NULLS LAST`),
  ]);

  const setups = rows<SetupRow>(setupR);
  const allItems = rows<SetupItemRow>(itemR);
  const eqOptions = rows<EqOption>(eqR);
  const groupOptions = rows<GroupOption>(grpR);
  const compat = rows<CompatPair>(compatR);
  const suggestions = rows<SuggestionRow>(suggR);

  const itemsByKit = new Map<string, SetupItemRow[]>();
  for (const it of allItems) {
    const arr = itemsByKit.get(it.kitId) ?? [];
    arr.push(it);
    itemsByKit.set(it.kitId, arr);
  }

  const setupsWithItems = setups.map((s) => ({
    ...s,
    items: itemsByKit.get(s.id) ?? [],
  }));

  const totalSetups = setups.length;
  const activeSetups = setups.filter((s) => s.active).length;
  const totalLines = allItems.length;
  const mandatoryLines = allItems.filter((i) => i.isMandatory).length;

  // ── AI hints from real data ────────────────────────────────────────────
  const hints: AIHint[] = [];
  const emptySetups = setupsWithItems.filter((s) => s.items.length === 0);
  if (emptySetups.length > 0) {
    hints.push({
      index: '01',
      text: `${emptySetups.length} سِتب بدون عناصر`,
      insight: 'ابدأ بإضافة العنصر الأساسي ثم العدسات/الإضاءة المتوافقة معه.',
    });
  }
  if (compat.length > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${compat.length} قاعدة توافق محفوظة`,
      insight: 'عند اختيار العنصر الأساسي ستُبرَز المرفقات المتوافقة تلقائياً.',
    });
  }
  if (suggestions.length > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${suggestions.length} اقتراح كيت متعلّم`,
      insight: 'اقتراحات من المشاريع السابقة — أضِفها بضغطة واحدة.',
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/equipment">
      <Link
        href="/equipment"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> المعدات
      </Link>

      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · بناء السِتب"
          headline={`${totalSetups} سِتب · ${totalLines} عنصر`}
          hints={hints}
          compact
        />
      )}

      <PageHeader
        eyebrow="Setups / Kit Builder"
        title="بناء السِتب"
        subtitle="ابنِ سِتب جاهز لكل نوع تصوير: اختر العنصر الأساسي، ثم أضِف المرفقات المتوافقة وعلّم الإلزامي. تُقترَح المرفقات من قواعد التوافق والمشاريع السابقة."
      />

      <section className="grid grid-cols-2 gap-4 stagger-in md:grid-cols-4">
        <StatBox label="السِتب" value={totalSetups} sub="مجموعة جاهزة" icon={<Boxes size={16} />} />
        <StatBox
          label="نشط"
          value={activeSetups}
          tone="success"
          sub="قابل للاستخدام الآن"
          icon={<Layers size={16} />}
        />
        <StatBox label="عناصر" value={totalLines} sub="عبر كل السِتب" icon={<Package size={16} />} />
        <StatBox
          label="إلزامي"
          value={mandatoryLines}
          tone={mandatoryLines > 0 ? 'warning' : 'default'}
          sub="لا يكتمل السِتب بدونها"
          icon={<CheckSquare size={16} />}
        />
      </section>

      <KitBuilder
        setups={setupsWithItems}
        eqOptions={eqOptions}
        groupOptions={groupOptions}
        compat={compat}
        suggestions={suggestions}
        canEdit={canEdit}
      />

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Equipment · Setups</span>
        <span>Volt Production · Jeddah</span>
      </div>
    </Shell>
  );
}
