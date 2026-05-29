import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, CardHeader, StatusPill, Avatar } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import {
  ArrowLeft,
  Mail,
  Phone,
  Briefcase,
  CalendarDays,
  Globe,
  IdCard,
  Banknote,
  Camera,
  Scissors,
  Plane,
  Building2,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can } from '@/lib/authz';
import { EditHrForm } from './EditHrForm';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type Detail = {
  profileId: string;
  displayName: string;
  displayNameEn: string | null;
  legalName: string | null;
  email: string;
  phoneE164: string | null;
  status: string;
  role: string;
  positionKey: string | null;
  departmentName: string | null;
  reportsToName: string | null;
  // employee
  jobTitle: string | null;
  hireDate: string | null;
  endDate: string | null;
  employmentType: string | null;
  nationality: string | null;
  nationalId: string | null;
  nationalIdType: string | null;
  monthlySalary: number | null;
  monthlySalaryCurrency: string | null;
  isFreelancer: boolean | null;
  canBeShooter: boolean | null;
  canBeEditor: boolean | null;
  canBePilot: boolean | null;
  hasRecord: boolean;
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  on_leave: 'warning',
  invited: 'neutral',
  inactive: 'neutral',
  terminated: 'danger',
};
const STATUS_LABEL_AR: Record<string, string> = {
  active: 'نشط',
  on_leave: 'في إجازة',
  invited: 'مدعو',
  inactive: 'غير نشط',
  terminated: 'منتهٍ',
};
const EMP_TYPE_AR: Record<string, string> = {
  full_time: 'دوام كامل',
  part_time: 'دوام جزئي',
  freelancer: 'فريلانسر',
};
const ID_TYPE_AR: Record<string, string> = {
  saudi: 'سعودي',
  iqama: 'إقامة',
  visitor: 'زائر',
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/employees/${id}`);

  const canManage = await can('access.manage');

  const r = rows<Detail>(
    await db.execute(sql`
      SELECT
        p.id::text                AS "profileId",
        p.display_name            AS "displayName",
        p.display_name_en         AS "displayNameEn",
        p.legal_name              AS "legalName",
        p.email,
        p.phone_e164              AS "phoneE164",
        p.status::text            AS status,
        p.role,
        p.position_key            AS "positionKey",
        d.name_ar                 AS "departmentName",
        mgr.display_name          AS "reportsToName",
        e.job_title               AS "jobTitle",
        e.hire_date               AS "hireDate",
        e.end_date                AS "endDate",
        e.employment_type         AS "employmentType",
        e.nationality,
        e.national_id             AS "nationalId",
        e.national_id_type        AS "nationalIdType",
        e.monthly_salary          AS "monthlySalary",
        e.monthly_salary_currency AS "monthlySalaryCurrency",
        e.is_freelancer           AS "isFreelancer",
        e.can_be_shooter          AS "canBeShooter",
        e.can_be_editor           AS "canBeEditor",
        e.can_be_pilot            AS "canBePilot",
        (e.profile_id IS NOT NULL) AS "hasRecord"
      FROM profiles p
      LEFT JOIN employees e     ON e.profile_id = p.id
      LEFT JOIN departments d   ON d.id = p.department_id
      LEFT JOIN profiles mgr    ON mgr.id = p.reports_to_id
      WHERE p.id = ${id}::uuid
      LIMIT 1
    `),
  )[0];

  if (!r) notFound();

  const caps = [
    r.canBeShooter && { label: 'مصوّر', icon: Camera },
    r.canBeEditor && { label: 'مونتير', icon: Scissors },
    r.canBePilot && { label: 'طيّار درون', icon: Plane },
  ].filter(Boolean) as { label: string; icon: typeof Camera }[];

  const salaryDisplay = !canManage
    ? '••••••'
    : r.monthlySalary != null
      ? `${new Intl.NumberFormat('en-US').format(r.monthlySalary)} ${r.monthlySalaryCurrency ?? 'SAR'}`
      : '—';

  const idDisplay = !canManage
    ? '••••••'
    : r.nationalId
      ? r.nationalId
      : '—';

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/employees">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الموظفون
      </Link>

      <PageHeader
        eyebrow="Employee · HR"
        title={r.displayName}
        subtitle={[r.jobTitle, r.departmentName].filter(Boolean).join(' · ') || r.email}
        action={
          <StatusPill tone={STATUS_TONE[r.status] ?? 'neutral'}>
            {STATUS_LABEL_AR[r.status] ?? r.status}
          </StatusPill>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Identity */}
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={r.displayName} size="lg" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--text)]">{r.displayName}</p>
              {r.displayNameEn && (
                <p className="text-[12px] text-[var(--text-muted)]" dir="ltr">
                  {r.displayNameEn}
                </p>
              )}
              {r.legalName && canManage && (
                <p className="text-[11px] text-[var(--text-dim)]">{r.legalName}</p>
              )}
            </div>
          </div>

          <dl className="mt-4 space-y-2.5 text-[13px]">
            <Row icon={<Mail size={12} />} v={<span className="font-mono text-[12px]" dir="ltr">{r.email}</span>} />
            {r.phoneE164 && (
              <Row icon={<Phone size={12} />} v={<span className="font-mono text-[12px]" dir="ltr">{r.phoneE164}</span>} />
            )}
            {r.departmentName && <Row icon={<Building2 size={12} />} v={r.departmentName} />}
            {r.reportsToName && <Row k="يتبع لـ" v={r.reportsToName} />}
            {r.positionKey && (
              <Row k="المنصب" v={<span className="font-mono text-[11px]">{r.positionKey}</span>} />
            )}
          </dl>
        </Card>

        {/* Employment */}
        <Card>
          <CardHeader title="بيانات التوظيف" />
          <dl className="mt-3 space-y-2.5 text-[13px]">
            <Row icon={<Briefcase size={12} />} k="المسمى" v={r.jobTitle ?? '—'} />
            <Row
              k="نوع التوظيف"
              v={r.employmentType ? (EMP_TYPE_AR[r.employmentType] ?? r.employmentType) : '—'}
            />
            <Row icon={<CalendarDays size={12} />} k="تاريخ التعيين" v={r.hireDate ?? '—'} />
            {r.endDate && <Row k="تاريخ الانتهاء" v={r.endDate} />}
            <Row icon={<Globe size={12} />} k="الجنسية" v={r.nationality ?? '—'} />
          </dl>
        </Card>

        {/* Sensitive (PDPL) — masked unless access.manage */}
        <Card>
          <CardHeader
            title="بيانات حسّاسة"
            subtitle={canManage ? undefined : 'مخفية — تتطلب صلاحية إدارة'}
          />
          <dl className="mt-3 space-y-2.5 text-[13px]">
            <Row
              icon={<Banknote size={12} />}
              k="الراتب الشهري"
              v={<span className="font-mono">{salaryDisplay}</span>}
            />
            <Row
              icon={<IdCard size={12} />}
              k="رقم الهوية"
              v={<span className="font-mono" dir="ltr">{idDisplay}</span>}
            />
            <Row
              k="نوع الهوية"
              v={r.nationalIdType ? (ID_TYPE_AR[r.nationalIdType] ?? r.nationalIdType) : '—'}
            />
          </dl>
        </Card>
      </div>

      {/* Production capabilities */}
      <Card>
        <CardHeader title="القدرات الإنتاجية" />
        <div className="mt-3 flex flex-wrap gap-2">
          {r.isFreelancer && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-[12px] text-[var(--text-muted)]">
              فريلانسر
            </span>
          )}
          {caps.length === 0 && !r.isFreelancer ? (
            <span className="text-[12px] text-[var(--text-dim)]">لا قدرات مسجّلة</span>
          ) : (
            caps.map((c) => {
              const Icon = c.icon;
              return (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] px-3 py-1 text-[12px] text-[var(--text)]"
                >
                  <Icon size={12} className="text-[var(--accent)]" />
                  {c.label}
                </span>
              );
            })
          )}
        </div>
      </Card>

      {/* Edit — gated. The action itself re-checks access.manage. */}
      {canManage && (
        <EditHrForm
          values={{
            profileId: r.profileId,
            jobTitle: r.jobTitle,
            hireDate: r.hireDate,
            endDate: r.endDate,
            employmentType: r.employmentType,
            nationality: r.nationality,
            nationalId: r.nationalId,
            nationalIdType: r.nationalIdType,
            monthlySalary: r.monthlySalary,
            monthlySalaryCurrency: r.monthlySalaryCurrency,
            isFreelancer: r.isFreelancer ?? false,
            canBeShooter: r.canBeShooter ?? false,
            canBeEditor: r.canBeEditor ?? false,
            canBePilot: r.canBePilot ?? false,
          }}
        />
      )}
    </Shell>
  );
}

function Row({
  k,
  v,
  icon,
}: {
  k?: string;
  v: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-[var(--text-dim)]">
        {icon && <span className="text-[var(--text-dim)]">{icon}</span>}
        {k && <span className="text-[12px]">{k}</span>}
      </dt>
      <dd className="min-w-0 truncate text-end text-[var(--text)]">{v}</dd>
    </div>
  );
}
