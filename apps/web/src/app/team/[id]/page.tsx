import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { db, withProfileScope, vTeamSafe } from '@antagna/db';
import { PageHeader, Card, CardHeader, StatusPill, EmptyState, Avatar } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Award, Briefcase, History, Mail, Phone } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getEffectiveProfileId } from '@/lib/authz';
import { stageTone, stageLabelAr } from '@/lib/project-stage';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

const ROLE_AR: Record<string, string> = {
  system_admin: 'مدير النظام',
  general_manager: 'المدير العام',
  project_manager: 'مدير مشاريع',
  account_manager: 'مدير حسابات',
  hr: 'موارد بشرية',
  finance: 'مالية',
  user: 'عضو فريق',
};

type Person = {
  id: string;
  displayName: string;
  displayNameEn: string | null;
  role: string;
  status: string;
  email: string | null;
  phoneE164: string | null;
  whatsappE164: string | null;
};

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/team/${id}`);

  const pid = await getEffectiveProfileId();

  const [personRows, capR, asgR, actR] = await Promise.all([
    // Masked profile read goes through v_team_safe inside withProfileScope so the
    // view's current_effective_profile_id() GUC masks email/phone/salary per the
    // logged-in (or viewed-as) user. WRITES stay on base tables.
    withProfileScope(pid, (tx) =>
      tx
        .select({
          id: sql<string>`${vTeamSafe.id}::text`.as('id'),
          displayName: vTeamSafe.displayName,
          displayNameEn: vTeamSafe.displayNameEn,
          role: vTeamSafe.role,
          status: sql<string>`${vTeamSafe.status}::text`.as('status'),
          email: vTeamSafe.email,
          phoneE164: vTeamSafe.phoneE164,
          whatsappE164: vTeamSafe.whatsappE164,
        })
        .from(vTeamSafe)
        .where(eq(vTeamSafe.id, id))
        .limit(1),
    ),
    db.execute(sql`
      SELECT c.name_ar AS name, c.category
      FROM user_skills uc JOIN skills c ON c.key = uc.skill_key
      WHERE uc.profile_id = ${id}::uuid ORDER BY c.category, c.position`),
    db.execute(sql`
      SELECT pa.role::text AS role, pa.rate_sar AS "rateSar", pa.rate_unit AS "rateUnit",
             pa.start_date AS "startDate", pa.end_date AS "endDate",
             p.id::text AS "projectId", COALESCE(p.title_ar, p.title) AS "projectTitle",
             p.stage::text AS stage
      FROM project_assignments pa
      LEFT JOIN projects p ON p.id = pa.project_id
      WHERE pa.profile_id = ${id}::uuid
      ORDER BY pa.assigned_at DESC LIMIT 30`),
    db.execute(sql`
      SELECT action, summary_ar AS summary, created_at AS at, project_id::text AS "projectId"
      FROM activity_events
      WHERE actor_id = ${id}::uuid OR acted_as_id = ${id}::uuid
      ORDER BY created_at DESC LIMIT 25`),
  ]);

  const person = personRows[0] as Person | undefined;
  if (!person) notFound();
  const caps = rows<{ name: string; category: string }>(capR);
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
  const activity = rows<{
    action: string;
    summary: string | null;
    at: string;
    projectId: string | null;
  }>(actR);

  const activeAssignments = assignments.filter(
    (a) => a.stage && !['delivered', 'archived', 'lost', 'cancelled'].includes(a.stage),
  );

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/team">
      <Link
        href="/team"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الفريق
      </Link>

      <PageHeader
        eyebrow={ROLE_AR[person.role] ?? person.role}
        title={person.displayName}
        subtitle={person.displayNameEn ?? undefined}
        action={
          <StatusPill tone={person.status === 'active' ? 'success' : 'neutral'}>
            {person.status === 'active' ? 'نشِط' : person.status}
          </StatusPill>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: identity + contact + skills */}
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={person.displayName} size="lg" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--text)]">
                {person.displayName}
              </p>
              <p className="text-[12px] text-[var(--text-muted)]">
                {ROLE_AR[person.role] ?? person.role}
              </p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-[13px]">
            {person.email && (
              <Row
                k={<Mail size={12} className="text-[var(--text-dim)]" />}
                v={<span className="font-mono text-[12px]" dir="ltr">{person.email}</span>}
              />
            )}
            {person.phoneE164 && (
              <Row
                k={<Phone size={12} className="text-[var(--text-dim)]" />}
                v={<span className="font-mono text-[12px]" dir="ltr">{person.phoneE164}</span>}
              />
            )}
          </dl>

          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              <Award size={12} /> المهارات ({caps.length})
            </p>
            {caps.length === 0 ? (
              <p className="text-[12px] text-[var(--text-dim)]">لا مهارات مسجّلة.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {caps.map((c, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)]"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Right: workload (assignments) */}
        <div className="space-y-4 lg:col-span-2">
          <Card padded={false}>
            <div className="p-6 pb-4">
              <CardHeader
                title="عبء العمل"
                subtitle={`${activeAssignments.length} مشروع نشط · ${assignments.length} إجمالاً`}
              />
            </div>
            {assignments.length === 0 ? (
              <EmptyState
                icon={<Briefcase size={20} />}
                title="لا إسنادات بعد"
                description="ستظهر هنا المشاريع المُسنَدة لهذا العضو."
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
              <CardHeader title="النشاط الأخير" subtitle="آخر ما قام به هذا العضو" />
            </div>
            {activity.length === 0 ? (
              <EmptyState icon={<History size={20} />} title="لا نشاط بعد" description="" />
            ) : (
              <ul className="space-y-0">
                {activity.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 border-t border-[var(--line)] px-6 py-3 first:border-t-0"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[var(--text)]">{a.summary ?? a.action}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
                        <span className="font-mono">{a.action}</span>
                        <span>·</span>
                        <span className="font-mono">
                          {new Date(a.at).toISOString().slice(0, 16).replace('T', ' ')}
                        </span>
                        {a.projectId && (
                          <>
                            <span>·</span>
                            <Link
                              href={`/projects/${a.projectId}`}
                              className="hover:text-[var(--accent)]"
                            >
                              المشروع
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="shrink-0">{k}</dt>
      <dd className="min-w-0 text-[var(--text)]">{v}</dd>
    </div>
  );
}
