import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, EmptyState, MiniStat, CardsGrid } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { UserSquare2 } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can } from '@/lib/authz';
import { EmployeesList, type EmployeeRow } from './EmployeesList';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type DbRow = {
  profileId: string;
  displayName: string;
  displayNameEn: string | null;
  email: string;
  status: string;
  jobTitle: string | null;
  departmentName: string | null;
  employmentType: string | null;
  nationality: string | null;
  hireDate: string | null;
  hasRecord: boolean;
  monthlySalary: number | null;
  monthlySalaryCurrency: string | null;
};

export default async function EmployeesPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/employees');

  const canManage = await can('access.manage');

  const list = rows<DbRow>(
    await db.execute(sql`
      SELECT
        p.id::text                                   AS "profileId",
        p.display_name                               AS "displayName",
        p.display_name_en                            AS "displayNameEn",
        p.email,
        p.status::text                               AS status,
        e.job_title                                  AS "jobTitle",
        d.name_ar                                    AS "departmentName",
        e.employment_type                            AS "employmentType",
        e.nationality,
        e.hire_date                                  AS "hireDate",
        (e.profile_id IS NOT NULL)                   AS "hasRecord",
        e.monthly_salary                             AS "monthlySalary",
        e.monthly_salary_currency                    AS "monthlySalaryCurrency"
      FROM profiles p
      LEFT JOIN employees e   ON e.profile_id = p.id
      LEFT JOIN departments d ON d.id = p.department_id
      WHERE p.archived_at IS NULL
      ORDER BY p.display_name
    `),
  );

  // Mask salary server-side so it never crosses the wire to a non-HR client.
  const data: EmployeeRow[] = list.map((r) => ({
    ...r,
    monthlySalary: canManage ? r.monthlySalary : null,
  }));

  const withRecord = data.filter((r) => r.hasRecord).length;
  const fullTime = data.filter((r) => r.employmentType === 'full_time').length;
  const freelancers = data.filter(
    (r) => r.employmentType === 'freelancer' || r.hasRecord === false,
  ).length;
  const totalPayroll = canManage
    ? data.reduce((sum, r) => sum + (r.monthlySalary ?? 0), 0)
    : null;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/employees">
      <PageHeader
        eyebrow="People · HR"
        title="الموظفون"
        subtitle={`${data.length} شخص · ${withRecord} ملف موظف مكتمل`}
      />

      <CardsGrid>
        <MiniStat span={3} label="إجمالي" value={data.length} tone="accent" />
        <MiniStat span={3} label="دوام كامل" value={fullTime} />
        <MiniStat span={3} label="بلا ملف HR" value={data.length - withRecord} sub="بحاجة لإكمال" />
        {canManage && totalPayroll != null ? (
          <MiniStat
            span={3}
            label="إجمالي الرواتب الشهرية"
            value={totalPayroll}
            sub="ر.س / شهر"
          />
        ) : (
          <MiniStat span={3} label="فريلانسرز" value={freelancers} />
        )}
      </CardsGrid>

      <Card padded={false} className="overflow-hidden">
        {data.length === 0 ? (
          <EmptyState
            icon={<UserSquare2 size={20} />}
            title="لا موظفين بعد"
            description="تُنشأ ملفات الموظفين تلقائياً مع المستخدمين المدعوين، ثم تُكمَّل بياناتهم هنا."
          />
        ) : (
          <div className="p-4">
            <EmployeesList rows={data} canSeeSalary={canManage} />
          </div>
        )}
      </Card>
    </Shell>
  );
}
