import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, AIHints, type AIHint } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { requirePermission } from '@/lib/authz';
import { getCurrentProfile } from '@/lib/view-as';
import { SkillsManager, type SkillRow } from './SkillsManager';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function SkillsCatalogPage() {
  await requirePermission('access.manage');
  const me = await getCurrentProfile();

  // Skills + a LEFT JOIN count of user_skills assignments per skill.
  const skillsR = await db.execute(sql`
    SELECT
      s.key,
      s.name_ar      AS "nameAr",
      s.name_en      AS "nameEn",
      s.category,
      s.description,
      s.icon_key     AS "iconKey",
      s.active,
      s.position,
      COALESCE(uc.cnt, 0)::int AS "usageCount"
    FROM skills s
    LEFT JOIN (
      SELECT skill_key, COUNT(*) AS cnt FROM user_skills GROUP BY skill_key
    ) uc ON uc.skill_key = s.key
    ORDER BY s.position, s.key
  `);

  const skills = rows<SkillRow>(skillsR);

  const total = skills.length;
  const inactive = skills.filter((s) => !s.active).length;
  const unused = skills.filter((s) => s.usageCount === 0).length;

  const hints: AIHint[] = [];
  if (unused > 0 && total > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${unused} مهارة غير مُسنَدة لأي عضو`,
      insight: 'راجعها — إمّا عطّلها أو أسنِدها من شاشة الأدوار والصلاحيات.',
    });
  }
  if (inactive > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${inactive} مهارة معطّلة`,
      insight: 'المهارات المعطّلة تختفي من قوائم الإسناد لكن تبقى على الأعضاء الحاليين.',
    });
  }

  return (
    <Shell user={{ email: me?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        ← الإدارة
      </Link>
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · كتالوج المهارات"
          headline={`${total} مهارة · ${total - inactive} نشطة`}
          hints={hints}
          compact
        />
      )}
      <PageHeader
        eyebrow="Skills catalog"
        title="كتالوج المهارات"
        subtitle="القدرات الإنتاجية التي تُسنَد لأعضاء الفريق — مصوّر، مونتير، طيّار درون… أضف، عدّل، رتّب، وفعّل/عطّل."
      />
      <SkillsManager skills={skills} />
    </Shell>
  );
}
