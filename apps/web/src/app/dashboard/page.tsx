import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  PageHeader,
  Card,
  EmptyState,
  StatusPill,
  Counter,
  Avatar,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import Link from 'next/link';
import {
  Briefcase,
  Users,
  Camera,
  ListChecks,
  Sparkles,
  ArrowUpRight,
  Inbox,
  Activity,
  Plus,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { stageTone, stageLabelAr } from '@/lib/project-stage';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard');

  const [stats] = (await db.execute<{
    active_projects: number;
    open_tasks: number;
    open_leads: number;
    equipment_count: number;
    open_threads: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM projects
        WHERE stage NOT IN ('delivered','archived','lost','cancelled')
          AND archived_at IS NULL) AS active_projects,
      (SELECT count(*)::int FROM project_tasks
        WHERE status IN ('pending','in_progress')) AS open_tasks,
      (SELECT count(*)::int FROM leads
        WHERE status IN ('new','qualified','nurturing')) AS open_leads,
      (SELECT count(*)::int FROM equipment
        WHERE archived_at IS NULL) AS equipment_count,
      (SELECT count(*)::int FROM email_threads
        WHERE status NOT IN ('closed','spam')) AS open_threads
  `)) as unknown as Array<{
    active_projects: number;
    open_tasks: number;
    open_leads: number;
    equipment_count: number;
    open_threads: number;
  }>;

  const recentProjects = (await db.execute<{
    id: string;
    code: string;
    title: string;
    title_ar: string | null;
    stage: string;
    updated_at: Date;
    pm_name: string | null;
    client_name: string | null;
    ai_risk: string | null;
  }>(sql`
    SELECT p.id, p.code, p.title, p.title_ar, p.stage, p.updated_at,
           prof.display_name AS pm_name,
           c.name_ar AS client_name,
           p.ai_risk_level AS ai_risk
    FROM projects p
    LEFT JOIN profiles prof ON prof.id = p.project_manager_id
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.archived_at IS NULL
    ORDER BY p.updated_at DESC
    LIMIT 6
  `)) as unknown as Array<{
    id: string;
    code: string;
    title: string;
    title_ar: string | null;
    stage: string;
    updated_at: Date;
    pm_name: string | null;
    client_name: string | null;
    ai_risk: string | null;
  }>;

  const recentActivity = (await db.execute<{
    id: string;
    action: string;
    summary_ar: string | null;
    summary_en: string | null;
    entity_type: string;
    entity_id: string | null;
    created_at: Date;
    actor_name: string | null;
  }>(sql`
    SELECT ae.id::text AS id, ae.action, ae.summary_ar, ae.summary_en,
           ae.entity_type, ae.entity_id::text AS entity_id,
           ae.created_at,
           p.display_name AS actor_name
    FROM activity_events ae
    LEFT JOIN profiles p ON p.id = ae.actor_id
    ORDER BY ae.created_at DESC
    LIMIT 8
  `)) as unknown as Array<{
    id: string;
    action: string;
    summary_ar: string | null;
    summary_en: string | null;
    entity_type: string;
    entity_id: string | null;
    created_at: Date;
    actor_name: string | null;
  }>;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'صباح الخير' : hour < 18 ? 'مرحباً' : 'مساء الخير';
  const dateStr = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Shell
      user={{ email: user.email ?? '', displayName: user.email?.split('@')[0] }}
      activePath="/dashboard"
    >
      <PageHeader
        eyebrow={`${greeting} · ${dateStr}`}
        title="لوحة التحكم"
        subtitle="نظرة عامة على كل شيء يحرّك Volt Production اليوم."
        action={
          <Link
            href="/projects/new"
            className="magnet inline-flex h-11 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-[13px] font-semibold text-black hover:bg-[var(--accent-hover)]"
          >
            <Plus size={15} />
            مشروع جديد
          </Link>
        }
      />

      {/* Stats row — 5 tiles */}
      <section className="grid grid-cols-2 gap-4 stagger-in md:grid-cols-3 lg:grid-cols-5">
        <DashStat
          label="مشاريع نشطة"
          value={stats?.active_projects ?? 0}
          sub="قيد التنفيذ"
          icon={<Briefcase size={16} />}
          href="/projects"
          tone="accent"
        />
        <DashStat
          label="مهام مفتوحة"
          value={stats?.open_tasks ?? 0}
          sub="على الفريق"
          icon={<ListChecks size={16} />}
          href="/tasks"
        />
        <DashStat
          label="Leads"
          value={stats?.open_leads ?? 0}
          sub="في الـ funnel"
          icon={<Users size={16} />}
          href="/crm"
        />
        <DashStat
          label="معدات"
          value={stats?.equipment_count ?? 0}
          sub="في الكتالوج"
          icon={<Camera size={16} />}
          href="/equipment"
        />
        <DashStat
          label="بريد وارد"
          value={stats?.open_threads ?? 0}
          sub="بحاجة لرد"
          icon={<Inbox size={16} />}
          href="/inbox"
        />
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr,1fr]">
        {/* Projects */}
        <section className="space-y-5">
          <header className="flex items-end justify-between gap-4">
            <div>
              <p className="section-rule" style={{ minWidth: 120 }}>
                المشاريع
              </p>
              <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
                نشاط أخير
              </h2>
            </div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] hover:underline"
            >
              عرض الكل
              <ArrowUpRight size={11} className="rtl:rotate-180" />
            </Link>
          </header>

          {recentProjects.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Briefcase size={18} />}
                title="لا توجد مشاريع بعد"
                description="ابدأ بإنشاء مشروع، أو شغّل demo data من صفحة الإدارة."
                action={
                  <Link
                    href="/projects/new"
                    className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-black hover:bg-[var(--accent-hover)]"
                  >
                    <Plus size={14} />
                    مشروع جديد
                  </Link>
                }
              />
            </Card>
          ) : (
            <ul className="space-y-px stagger-in">
              {recentProjects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="grid grid-cols-[64px,1fr,auto] items-center gap-4 border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 px-5 py-4 hover:bg-[var(--bg-elevated)]/80"
                  >
                    <span className="font-mono text-[11px] text-[var(--text-dim)]">
                      {p.code}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-[var(--text)]">
                        {p.title_ar ?? p.title}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {p.client_name ?? '—'}
                        {p.pm_name && (
                          <>
                            {' '}·{' '}
                            <span className="text-[var(--text)]">{p.pm_name}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.ai_risk === 'red' && (
                        <StatusPill tone="danger">خطر</StatusPill>
                      )}
                      <StatusPill tone={stageTone(p.stage)}>
                        {stageLabelAr(p.stage)}
                      </StatusPill>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Activity feed */}
        <section className="space-y-5">
          <header className="flex items-end justify-between gap-4">
            <div>
              <p className="section-rule" style={{ minWidth: 140 }}>
                مجرى النشاط
              </p>
              <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
                آخر التحديثات
              </h2>
            </div>
          </header>

          {recentActivity.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Activity size={18} />}
                title="هادئ هنا"
                description="سيظهر النشاط هنا تلقائياً مع كل تغيير في النظام."
              />
            </Card>
          ) : (
            <ul className="space-y-0 stagger-in">
              {recentActivity.map((a) => {
                const minsAgo = Math.floor(
                  (Date.now() - new Date(a.created_at).getTime()) / 60000,
                );
                return (
                  <li
                    key={a.id}
                    className="relative border-r-2 border-[var(--line)] px-5 py-3 hover:border-[var(--accent)]"
                  >
                    <span className="absolute end-[-5px] top-5 h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <p className="text-[13px] text-[var(--text)]">
                      {a.summary_ar ?? a.summary_en ?? a.action}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
                      {a.actor_name ?? 'النظام'} ·{' '}
                      {minsAgo < 60
                        ? `${minsAgo}د`
                        : minsAgo < 1440
                          ? `${Math.floor(minsAgo / 60)}س`
                          : `${Math.floor(minsAgo / 1440)}ي`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* AI hint */}
      <div className="rounded-lg border border-[var(--accent)]/25 bg-gradient-to-l from-[var(--accent)]/[0.06] to-transparent p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--accent)]/30 text-[var(--accent)]">
            <Sparkles size={15} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              AI · Insights Scanner
            </p>
            <p className="text-[14px] text-[var(--text)]">
              لما الـ worker يبدأ شغّال، هتلاقي هنا تلخيص لما حصل في الـ24
              ساعة الماضية + توصيات للخطوات التالية لكل مشروع.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Dashboard</span>
        <span>{new Date().getFullYear()} · Volt Production</span>
      </div>

      <Avatar name="" className="hidden" />
    </Shell>
  );
}

function DashStat({
  label,
  value,
  sub,
  icon,
  href,
  tone = 'default',
}: {
  label: string;
  value: number;
  sub?: string;
  icon?: React.ReactNode;
  href?: string;
  tone?: 'default' | 'accent';
}) {
  const numColor = tone === 'accent' ? 'text-[var(--accent)]' : 'text-[var(--text)]';
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
          {label}
        </span>
        {icon && (
          <span className="text-[var(--text-dim)] group-hover:text-[var(--accent)]">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-5">
        <span
          className={`text-[40px] font-bold leading-none tracking-tight tabular ${numColor}`}
        >
          <Counter to={value} />
        </span>
      </div>
      {sub && <p className="mt-2 text-[11px] text-[var(--text-muted)]">{sub}</p>}
      {href && (
        <ArrowUpRight
          size={12}
          className="absolute bottom-5 start-5 text-[var(--text-dim)] opacity-0 transition-opacity group-hover:text-[var(--accent)] group-hover:opacity-100 rtl:rotate-180"
        />
      )}
    </>
  );
  const cls =
    'group relative overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-6 backdrop-blur ' +
    (href ? 'magnet cursor-pointer hover:border-[var(--line-strong)]' : '');
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}
