import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql, eq } from 'drizzle-orm';
import { db, profiles, skills, departments } from '@antagna/db';
import {
  PageHeader,
  Card,
  StatusPill,
  EmptyState,
  Avatar,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { StatBox } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { UserSquare2, Briefcase, Users, Sparkles } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/team');

  const [people, caps, depts] = await Promise.all([
    db.execute<{
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
      FROM profiles p
      LEFT JOIN departments d ON d.id = p.department_id
      LEFT JOIN employees e ON e.profile_id = p.id
      WHERE p.archived_at IS NULL
      ORDER BY p.display_name
    `),
    db.select().from(skills).orderBy(skills.position, skills.key),
    db.select().from(departments).orderBy(departments.position),
  ]);

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

  const capsByKey = new Map(caps.map((c) => [c.key, c]));

  const active = peopleArr.filter((p) => p.status === 'active').length;
  const totalProjects = peopleArr.reduce((s, p) => s + Number(p.active_projects), 0);

  // Group by department
  const byDept: Record<string, typeof peopleArr> = {};
  for (const p of peopleArr) {
    const key = p.department_name ?? 'بدون قسم';
    (byDept[key] ??= []).push(p);
  }

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
          <div className="flex items-center gap-2">
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

      {peopleArr.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserSquare2 size={18} />}
            title="لا يوجد أعضاء فريق بعد"
            description="هيتم إنشاء الـ profiles تلقائياً عند تسجيل الفريق، أو من Pillar 15 migration."
          />
        </Card>
      ) : (
        Object.entries(byDept).map(([deptName, list]) => (
          <section key={deptName} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                — {deptName}
              </h2>
              <span className="text-[10px] text-[var(--text-dim)]">
                {list.length} عضو
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 stagger-in md:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => {
                const caps = (p.capability_keys ?? []).slice(0, 4);
                const moreCaps = (p.capability_keys ?? []).length - caps.length;
                return (
                  <article
                    key={p.id}
                    className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-5"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={p.display_name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/team/${p.id}`}
                            className="truncate text-[14px] font-semibold text-[var(--text)] hover:text-[var(--accent)]"
                          >
                            {p.display_name}
                          </Link>
                          {p.status !== 'active' && (
                            <StatusPill tone="neutral">{p.status}</StatusPill>
                          )}
                        </div>
                        {p.job_title && (
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {p.job_title}
                          </p>
                        )}
                        <p className="font-mono text-[10px] text-[var(--text-dim)] truncate">
                          {p.email}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-3 text-[11px]">
                      <div>
                        <p className="text-[var(--text-dim)]">المشاريع النشطة</p>
                        <p className="mt-0.5 font-mono text-[16px] font-semibold text-[var(--text)]">
                          {p.active_projects}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-dim)]">المهارات</p>
                        <p className="mt-0.5 font-mono text-[16px] font-semibold text-[var(--text)]">
                          {p.capability_count}
                        </p>
                      </div>
                    </div>

                    {caps.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-3">
                        {caps.map((key) => {
                          const cap = capsByKey.get(key);
                          return (
                            <span
                              key={key}
                              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                            >
                              {cap?.nameAr ?? key}
                            </span>
                          );
                        })}
                        {moreCaps > 0 && (
                          <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-dim)]">
                            +{moreCaps}
                          </span>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      {caps.length > 0 && (
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
            <div className="grid grid-cols-1 divide-y divide-[var(--line)] md:grid-cols-2 md:divide-x md:divide-y-0 md:divide-x-reverse">
              {caps.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="text-[13px] text-[var(--text)]">
                      {c.nameAr}
                    </p>
                    <p className="text-[10px] text-[var(--text-dim)]">
                      {c.nameEn} · {c.category ?? '—'}
                    </p>
                  </div>
                  <Briefcase size={13} className="text-[var(--text-dim)]" />
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Team</span>
        <span>Volt Production · Jeddah</span>
      </div>

      {/* keep unused import lint quiet */}
      <span className="hidden" data-eq={String(eq)}>{' '}</span>
    </Shell>
  );
}

