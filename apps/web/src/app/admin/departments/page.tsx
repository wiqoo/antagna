import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import {
  DepartmentsManager,
  type DeptRow,
  type PersonOption,
} from './DepartmentsManager';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function DepartmentsAdminPage() {
  // Page guard: signed-out → /login, lacking access.manage → /dashboard.
  await requirePermission('access.manage');

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [deptRows, peopleRows] = await Promise.all([
    db.execute(sql`
      SELECT
        d.id::text         AS id,
        d.code,
        d.name_ar          AS "nameAr",
        d.name_en          AS "nameEn",
        d.head_profile_id::text AS "headProfileId",
        h.display_name     AS "headName",
        d.position,
        (
          SELECT count(*)::int FROM profiles p
          WHERE p.department_id = d.id AND p.archived_at IS NULL
        ) AS "memberCount"
      FROM departments d
      LEFT JOIN profiles h ON h.id = d.head_profile_id
      ORDER BY d.position, d.name_ar
    `),
    db.execute(sql`
      SELECT id::text AS id, display_name AS "displayName"
      FROM profiles
      WHERE archived_at IS NULL
      ORDER BY display_name
    `),
  ]);

  const departments = rows<DeptRow>(deptRows);
  const people = rows<PersonOption>(peopleRows);

  return (
    <Shell user={{ email: user?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الإدارة
      </Link>

      <PageHeader
        eyebrow="Admin · Org"
        title="الأقسام"
        subtitle="نظّم هيكل الفريق — أنشئ الأقسام وعيّن رؤساءها واربط الموظفين بها."
      />

      <Card>
        <DepartmentsManager departments={departments} people={people} />
      </Card>
    </Shell>
  );
}
