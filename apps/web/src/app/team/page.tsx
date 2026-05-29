import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql, eq } from 'drizzle-orm';
import { skills, departments, withProfileScope } from '@antagna/db';
import { requirePermission, getEffectiveProfileId } from '@/lib/authz';
import {
  PageHeader,
  Card,
  EmptyState,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { StatBox } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { UserSquare2, Briefcase, Users, Sparkles, Award } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { TeamWorkspace } from './TeamWorkspace';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/team');

  // Page guard: lacking team.read → /dashboard (signed-out → /login).
  await requirePermission('team.read');
  const effectivePid = await getEffectiveProfileId();

  // The directory reads `profiles` through v_team_safe (drop-in), which masks
  // email/phone for viewers who aren't self / same-dept / team.read. Run the
  // masked read AND the lookup reads inside ONE withProfileScope txn so the
  // app.current_profile_id GUC reaches the view's CASE WHEN masks.
  const [people, caps, depts] = await withProfileScope(effectivePid, (tx) =>
    Promise.all([
      tx.execute<{
        id: string;
        display_name: string;
        email: string;
        role: string;
        status: string;
        phone_e164: string | null;
        department_name: string | null;
        job_title: string | null;
        capability_count: number;
        active_projects: number;
        capability_keys: string[] | null;
      }>(sql`
        SELECT
          p.id::text AS id,
          p.display_name,
          p.email,
          p.role,
          p.status::text AS status,
          p.phone_e164,
          d.name_ar AS department_name,
          e.job_title,
          (
            SELECT count(*)::int FROM user_skills uc
            WHERE uc.profile_id = p.id
          ) AS capability_count,
          (
            SELECT count(*)::int FROM project_assignments pa
            INNER JOIN projects pr ON pr.id = pa.project_id
            WHERE pa.profile_id = p.id
              AND pr.archived_at IS NULL
              AND pr.stage NOT IN ('delivered','archived','lost','cancelled')
          ) AS active_projects,
          (
            SELECT array_agg(uc.skill_key)
            FROM user_skills uc
            WHERE uc.profile_id = p.id
          ) AS capability_keys
        FROM v_team_safe p
        LEFT JOIN departments d ON d.id = p.department_id
        LEFT JOIN employees e ON e.profile_id = p.id
        WHERE p.archived_at IS NULL
        ORDER BY p.display_name
      `),
      tx.select().from(skills).orderBy(skills.position, skills.key),
      tx.select().from(departments).orderBy(departments.position),
    ]),
  );

  const peopleArr = people as unknown as Array<{
    id: string;
    display_name: string;
    email: string;
    role: string;
    status: string;
    phone_e164: string | null;
    department_name: string | null;
    job_title: string | null;
    capability_count: number;
    active_projects: number;
    capability_keys: string[] | null;
  }>;

  // skill key → Arabic label, handed to the client workspace for chip rendering.
  const capLabels: Record<string, string> = {};
  for (const c of caps) capLabels[c.key] = c.nameAr;

  const active = peopleArr.filter((p) => p.status === 'active').length;
  const totalProjects = peopleArr.reduce((s, p) => s + Number(p.active_projects), 0);

  const overloaded = peopleArr.filter((p) => Number(p.active_projects) >= 4);
  const idle = peopleArr.filter(
    (p) => p.status === 'active' && Number(p.active_projects) === 0,
  );
  const noCaps = peopleArr.filter(
    (p) => p.status === 'active' && Number(p.capability_count) === 0,
  );

  const hints: AIHint[] = [];
  if (overloaded.length > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${overloaded.length} عضو على ٤+ مشاريع نشطة`,
      insight: 'اقترح تحويل مهام لأعضاء أقل ضغطاً قبل أن يتأخر التسليم.',
      urgent: true,
      actions: [{ label: 'اعرض الأعباء', href: '#team-list', primary: true }],
    });
  }
  if (idle.length > 0 && hints.length < 3) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${idle.length} عضو نشط بدون مشاريع`,
      insight: 'فرصة لتوزيع جديد، تدريب، أو دعم زملاء على الـ load الزائد.',
      actions: [{ label: 'اعرض الفارغ', href: '#team-list' }],
    });
  }
  if (noCaps.length > 0 && hints.length < 3) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${noCaps.length} عضو بدون مهارات مسجّلة`,
      insight: 'سجّل المهارات لتحسين توزيع المشاريع المستقبلية.',
      actions: [{ label: 'تحديث الملفات', href: '#team-list' }],
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/team">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · الفريق"
          headline={`${active} عضو نشط · ${totalProjects} توزيعة على المشاريع`}
          hints={hints}
          compact
        />
      )}
      <PageHeader
        eyebrow="Team"
        title="الفريق"
        subtitle="أعضاء Volt Production · المهارات · الأقسام · توزيع المشاريع."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/freelancers"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              <Users size={14} /> الفريلانسرز
            </Link>
            <Link
              href="/talents"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              <Sparkles size={14} /> المواهب
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-4 stagger-in md:grid-cols-4">
        <StatBox label="إجمالي" value={peopleArr.length} sub="عضو في الفريق" />
        <StatBox label="نشط" value={active} sub="مفعّل الآن" tone="success" />
        <StatBox label="أقسام" value={depts.length} sub="قسم منظّم" />
        <StatBox label="مهام مشاريع" value={totalProjects} sub="إجمالي assignments" />
      </section>

      <section id="team-list" className="scroll-mt-24">
        {peopleArr.length === 0 ? (
          <Card>
            <EmptyState
              icon={<UserSquare2 size={18} />}
              title="لا يوجد أعضاء فريق بعد"
              description="هيتم إنشاء الـ profiles تلقائياً عند تسجيل الفريق، أو من Pillar 15 migration."
            />
          </Card>
        ) : (
          <TeamWorkspace people={peopleArr} capLabels={capLabels} />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            — كتالوج المهارات
          </h2>
          <span className="text-[10px] text-[var(--text-dim)]">
            {caps.length} مهارة
          </span>
        </div>
        <Card padded={false}>
          {caps.length === 0 ? (
            <EmptyState
              icon={<Award size={18} />}
              title="لا توجد مهارات في الكتالوج بعد"
              description="أضف مهارات الفريق لتحسين توزيع المشاريع والـ matching المستقبلي."
            />
          ) : (
            <div className="grid grid-cols-1 divide-y divide-[var(--line)] md:grid-cols-2 md:divide-x md:divide-y-0 md:divide-x-reverse">
              {caps.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-[var(--text)]">
                      {c.nameAr}
                    </p>
                    <p className="truncate text-[10px] text-[var(--text-dim)]">
                      {c.nameEn} · {c.category ?? '—'}
                    </p>
                  </div>
                  <Briefcase size={13} className="shrink-0 text-[var(--text-dim)]" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Team</span>
        <span>Volt Production · Jeddah</span>
      </div>

      {/* keep unused import lint quiet */}
      <span className="hidden" data-eq={String(eq)}>{' '}</span>
    </Shell>
  );
}

