import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, CardHeader, StatusPill, EmptyState, Avatar } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Star, MapPin, Briefcase, Mail, Sparkles } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can, requirePermission } from '@/lib/authz';
import { stageTone, stageLabelAr } from '@/lib/project-stage';
import { addFreelancerAvailability, removeFreelancerAvailability } from '../actions';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

const RATE_UNIT_AR: Record<string, string> = {
  per_day: '/ يوم',
  per_project: '/ مشروع',
  per_hour: '/ ساعة',
};

type Freelancer = {
  id: string;
  code: string;
  fullName: string;
  fullNameAr: string | null;
  emailPrimary: string | null;
  specialties: string[] | null;
  cityBase: string | null;
  defaultRateSar: string | null;
  defaultRateUnit: string | null;
  projectsCompleted: number;
  averageRating: string | null;
  lastWorkedAt: string | null;
  preferred: boolean;
  payoutMethodRef: string | null;
  notes: string | null;
};

export default async function FreelancerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/freelancers/${id}`);
  await requirePermission('team.read');

  // Financial/PII fields (rate, email, payout method) are a narrower grant
  // than directory access — masked unless the viewer holds financials.read.
  const canFinance = await can('financials.read');

  const [fR, asgR, avR] = await Promise.all([
    db.execute(sql`
      SELECT id::text AS id, code, full_name AS "fullName", full_name_ar AS "fullNameAr",
             ${canFinance ? sql`email_primary` : sql`NULL::text`} AS "emailPrimary",
             specialties, city_base AS "cityBase",
             ${canFinance ? sql`default_rate_sar` : sql`NULL::numeric`} AS "defaultRateSar",
             ${canFinance ? sql`default_rate_unit` : sql`NULL::text`} AS "defaultRateUnit",
             projects_completed AS "projectsCompleted", average_rating AS "averageRating",
             last_worked_at AS "lastWorkedAt", preferred,
             ${canFinance ? sql`payout_method_ref` : sql`NULL::text`} AS "payoutMethodRef", notes
      FROM freelancers WHERE id = ${id}::uuid LIMIT 1`),
    db.execute(sql`
      SELECT pa.role::text AS role,
             ${canFinance ? sql`pa.rate_sar` : sql`NULL::numeric`} AS "rateSar",
             ${canFinance ? sql`pa.rate_unit` : sql`NULL::text`} AS "rateUnit",
             pa.start_date AS "startDate", pa.end_date AS "endDate",
             p.id::text AS "projectId", COALESCE(p.title_ar, p.title) AS "projectTitle",
             p.stage::text AS stage
      FROM project_assignments pa
      LEFT JOIN projects p ON p.id = pa.project_id
      WHERE pa.freelancer_id = ${id}::uuid
      ORDER BY pa.assigned_at DESC LIMIT 30`),
    db.execute(sql`
      SELECT id::text AS id, starts_at AS "startsAt", ends_at AS "endsAt", status, note
      FROM freelancer_availability WHERE freelancer_id = ${id}::uuid
      ORDER BY starts_at DESC LIMIT 20`),
  ]);

  const f = rows<Freelancer>(fR)[0];
  if (!f) notFound();
  const availability = rows<{
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    note: string | null;
  }>(avR);
  const assignments = rows<{
    role: string;
    rateSar: string | null;
    rateUnit: string | null;
    startDate: string | null;
    endDate: string | null;
    projectId: string | null;
    projectTitle: string | null;
    stage: string | null;
  }>(asgR);

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/team">
      <Link
        href="/freelancers"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الفريلانسرز
      </Link>

      <PageHeader
        eyebrow="Freelancer"
        title={f.fullNameAr ?? f.fullName}
        subtitle={`${f.fullName} · ${f.code}`}
        action={
          f.preferred ? (
            <StatusPill tone="accent">
              <Sparkles size={11} className="inline" /> مفضّل
            </StatusPill>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={f.fullNameAr ?? f.fullName} size="lg" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--text)]">
                {f.fullNameAr ?? f.fullName}
              </p>
              {f.cityBase && (
                <p className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
                  <MapPin size={11} className="text-[var(--text-dim)]" /> {f.cityBase}
                </p>
              )}
            </div>
          </div>

          <dl className="mt-4 space-y-2 text-[13px]">
            {canFinance && f.emailPrimary && (
              <Row
                k={<Mail size={12} className="text-[var(--text-dim)]" />}
                v={<span className="font-mono text-[12px]" dir="ltr">{f.emailPrimary}</span>}
              />
            )}
            {canFinance && (
              <Row
                k="السعر الافتراضي"
                v={
                  f.defaultRateSar
                    ? `${Number(f.defaultRateSar).toLocaleString('en-US')} ر.س ${RATE_UNIT_AR[f.defaultRateUnit ?? ''] ?? ''}`
                    : '—'
                }
              />
            )}
            <Row
              k="التقييم"
              v={
                f.averageRating ? (
                  <span className="inline-flex items-center gap-1">
                    <Star size={12} className="fill-[var(--accent)] text-[var(--accent)]" />
                    {Number(f.averageRating).toFixed(1)}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <Row k="مشاريع مكتملة" v={String(f.projectsCompleted)} />
            <Row
              k="آخر عمل"
              v={f.lastWorkedAt ? new Date(f.lastWorkedAt).toISOString().slice(0, 10) : 'لم يعمل'}
              mono
            />
            {canFinance && f.payoutMethodRef && <Row k="طريقة الدفع" v={f.payoutMethodRef} />}
          </dl>

          {f.specialties && f.specialties.length > 0 && (
            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                التخصصات
              </p>
              <div className="flex flex-wrap gap-1.5">
                {f.specialties.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {f.notes && (
            <p className="mt-4 border-t border-[var(--line)] pt-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
              {f.notes}
            </p>
          )}
        </Card>

        <div className="lg:col-span-2">
          <Card padded={false}>
            <div className="p-6 pb-4">
              <CardHeader
                title="سجل التعاون"
                subtitle={`${assignments.length} إسناد على المشاريع`}
              />
            </div>
            {assignments.length === 0 ? (
              <EmptyState
                icon={<Briefcase size={20} />}
                title="لا تعاون بعد"
                description="ستظهر هنا المشاريع التي أُسند إليها هذا الفريلانسر."
              />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {assignments.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      {a.projectId ? (
                        <Link
                          href={`/projects/${a.projectId}`}
                          className="text-[13px] text-[var(--text)] hover:text-[var(--accent)]"
                        >
                          {a.projectTitle}
                        </Link>
                      ) : (
                        <span className="text-[13px] text-[var(--text)]">—</span>
                      )}
                      <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                        {a.role}
                        {a.rateSar
                          ? ` · ${Number(a.rateSar).toLocaleString('en-US')} ر.س ${a.rateUnit ?? ''}`
                          : ''}
                        {a.startDate ? ` · ${a.startDate}` : ''}
                      </p>
                    </div>
                    {a.stage && (
                      <StatusPill tone={stageTone(a.stage)} withDot={false}>
                        {stageLabelAr(a.stage)}
                      </StatusPill>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-4">
              <CardHeader title="التوفّر" subtitle="نوافذ الإتاحة لإسناد المشاريع" />
            </div>
            <div className="px-6 pb-3">
              {availability.length === 0 ? (
                <p className="text-[12px] text-[var(--text-dim)]">لا نوافذ توفّر مسجّلة.</p>
              ) : (
                <ul className="space-y-1.5">
                  {availability.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-[12px]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <StatusPill
                          tone={
                            a.status === 'available'
                              ? 'success'
                              : a.status === 'busy'
                                ? 'danger'
                                : 'warning'
                          }
                          withDot={false}
                        >
                          {a.status === 'available'
                            ? 'متاح'
                            : a.status === 'busy'
                              ? 'مشغول'
                              : 'مبدئي'}
                        </StatusPill>
                        <span className="font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
                          {new Date(a.startsAt).toISOString().slice(0, 10)} →{' '}
                          {new Date(a.endsAt).toISOString().slice(0, 10)}
                        </span>
                        {a.note && <span className="text-[var(--text-dim)]">· {a.note}</span>}
                      </span>
                      <form action={removeFreelancerAvailability.bind(null, f.id, a.id)}>
                        <button
                          type="submit"
                          className="text-[var(--text-dim)] hover:text-[var(--danger)]"
                        >
                          ✕
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <form
              action={addFreelancerAvailability.bind(null, f.id)}
              className="grid grid-cols-1 gap-2 border-t border-[var(--line)] px-6 py-4 sm:grid-cols-[1fr_1fr_120px_auto]"
            >
              <input name="startsAt" type="date" required dir="ltr" className="fa-in" />
              <input name="endsAt" type="date" required dir="ltr" className="fa-in" />
              <select name="status" defaultValue="available" className="fa-in">
                <option value="available">متاح</option>
                <option value="busy">مشغول</option>
                <option value="tentative">مبدئي</option>
              </select>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-black hover:opacity-90"
              >
                + أضف
              </button>
            </form>
            <style>{`.fa-in{height:36px;border-radius:8px;border:1px solid var(--line);background:var(--bg-elevated);color:var(--text);font-size:13px;padding:0 10px;}.fa-in:focus{outline:none;border-color:var(--accent);}`}</style>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function Row({ k, v, mono }: { k: React.ReactNode; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--text-dim)]">{k}</dt>
      <dd className={'text-[var(--text)] ' + (mono ? 'font-mono text-[12px]' : '')}>{v}</dd>
    </div>
  );
}
