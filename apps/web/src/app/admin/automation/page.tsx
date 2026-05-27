import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { requirePermission } from '@/lib/authz';
import { getCurrentProfile } from '@/lib/view-as';
import { AutomationManager } from './automation-manager';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function AutomationPage() {
  await requirePermission('automation.manage');
  const me = await getCurrentProfile();

  const [rulesR, kpisR] = await Promise.all([
    db.execute(sql`
      SELECT id::text AS id, key, name_ar AS "nameAr", name_en AS "nameEn", description,
             trigger_type AS "triggerType", trigger_spec AS "triggerSpec",
             recipient_strategy AS "recipientStrategy", cooldown_minutes AS "cooldownMinutes", active
      FROM alert_rules ORDER BY active DESC, key`),
    db.execute(sql`
      SELECT key, name_ar AS "nameAr", name_en AS "nameEn", scope, unit,
             compute_sql AS "computeSql",
             threshold_green::float8 AS "thresholdGreen", threshold_amber::float8 AS "thresholdAmber",
             refresh_frequency AS "refreshFrequency", active
      FROM kpi_definitions ORDER BY scope, key`),
  ]);

  return (
    <Shell user={{ email: me?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        ← الإدارة
      </Link>
      <PageHeader
        eyebrow="Automation"
        title="قواعد التنبيهات والمؤشرات"
        subtitle="حرّر منطق المراقبة مباشرةً: قواعد التنبيهات (التوقيت، المستقبِلون، فترة التهدئة) ومؤشرات الأداء (حدود الأخضر والأصفر). التغييرات تسري دون إعادة نشر. صيغة حساب المؤشر (compute_sql) تبقى مُدارة بالكود لأسباب أمنية."
      />
      <AutomationManager rules={rows(rulesR)} kpis={rows(kpisR)} />
    </Shell>
  );
}
