import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  
  PageHeader,
  StatTile,
  Card,
  CardHeader,
  EmptyState,
  StatusPill,
  Button,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import {
  Briefcase,
  Users,
  Camera,
  ListChecks,
  Sparkles,
  ArrowUpRight,
  Inbox,
  Activity,
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

  // Pull dashboard stats. Empty DB still resolves to zeros — no crashes.
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

  const greeting = new Date().getHours() < 12
    ? 'صباح الخير'
    : new Date().getHours() < 18
      ? 'مرحباً'
      : 'مساء الخير';

  return (
    <Shell
      user={{ email: user.email ?? '', displayName: user.email?.split('@')[0] }}
      activePath="/dashboard"
    >
      <PageHeader
        eyebrow={greeting}
        title="مرحباً بك في Antagna"
        subtitle="نظام التشغيل الداخلي لـ Volt Production — كل المشاريع والمعدات والعملاء في مكان واحد."
        action={
          <Button
            variant="primary"
            size="lg"
            icon={<Sparkles size={16} />}
            onClick={undefined}
          >
            <a href="/projects/new" className="contents">
              مشروع جديد
            </a>
          </Button>
        }
      />

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="مشاريع نشطة"
          value={stats?.active_projects ?? 0}
          sub="قيد التنفيذ الآن"
          icon={<Briefcase size={18} />}
          tone="accent"
          href="/projects"
        />
        <StatTile
          label="مهام مفتوحة"
          value={stats?.open_tasks ?? 0}
          sub="على الفريق"
          icon={<ListChecks size={18} />}
          href="/tasks"
        />
        <StatTile
          label="فرص (leads)"
          value={stats?.open_leads ?? 0}
          sub="في الـ funnel"
          icon={<Users size={18} />}
          tone="success"
          href="/crm"
        />
        <StatTile
          label="معدات"
          value={stats?.equipment_count ?? 0}
          sub="في الكتالوج"
          icon={<Camera size={18} />}
          href="/equipment"
        />
        <StatTile
          label="محادثات وارد"
          value={stats?.open_threads ?? 0}
          sub="بحاجة لرد"
          icon={<Inbox size={18} />}
          tone="warning"
          href="/inbox"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent projects */}
        <Card className="lg:col-span-2" padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title="مشاريع حديثة"
              subtitle="آخر 6 مشاريع تم تحديثها"
              action={
                <a
                  href="/projects"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[--accent] hover:underline"
                >
                  عرض الكل
                  <ArrowUpRight size={14} />
                </a>
              }
            />
          </div>
          {recentProjects.length === 0 ? (
            <EmptyState
              icon={<Briefcase size={20} />}
              title="لا توجد مشاريع بعد"
              description="ابدأ بإنشاء أول مشروع — يمكنك استخدام template أو البدء من الصفر."
              action={
                <a
                  href="/projects/new"
                  className="inline-flex h-9 items-center rounded-xl bg-[--accent] px-4 text-sm font-medium text-black hover:bg-[--accent-hover]"
                >
                  + مشروع جديد
                </a>
              }
            />
          ) : (
            <ul className="divide-y divide-[--line]">
              {recentProjects.map((p) => (
                <li key={p.id}>
                  <a
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-[--surface-hover]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[--text-dim]">
                          {p.code}
                        </span>
                        <StatusPill tone={stageTone(p.stage)}>
                          {stageLabelAr(p.stage)}
                        </StatusPill>
                        {p.ai_risk === 'red' && (
                          <StatusPill tone="danger">⚠ خطر</StatusPill>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-[--text]">
                        {p.title_ar ?? p.title}
                      </p>
                      <p className="truncate text-xs text-[--text-muted]">
                        {p.client_name ?? '—'}
                        {p.pm_name && <> · {p.pm_name}</>}
                      </p>
                    </div>
                    <ArrowUpRight
                      size={14}
                      className="text-[--text-dim] rtl:rotate-180"
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Activity feed */}
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title="آخر النشاط"
              subtitle="آخر 8 أحداث في النظام"
            />
          </div>
          {recentActivity.length === 0 ? (
            <EmptyState
              icon={<Activity size={20} />}
              title="هادئ هنا"
              description="لا يوجد نشاط بعد — سيظهر هنا كل ما يحدث في النظام."
            />
          ) : (
            <ul className="space-y-0">
              {recentActivity.map((a) => {
                const minsAgo = Math.floor(
                  (Date.now() - new Date(a.created_at).getTime()) / 60000,
                );
                return (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 border-t border-[--line] px-6 py-3 first:border-t-0"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[--accent]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[--text]">
                        {a.summary_ar ?? a.summary_en ?? a.action}
                      </p>
                      <p className="text-[11px] text-[--text-dim]">
                        {a.actor_name ?? 'النظام'} ·{' '}
                        {minsAgo < 60
                          ? `${minsAgo}د`
                          : minsAgo < 1440
                            ? `${Math.floor(minsAgo / 60)}س`
                            : `${Math.floor(minsAgo / 1440)}ي`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}
