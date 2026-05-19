import { redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import {
  db,
  profiles,
  alertRules,
  kpiDefinitions,
  permissions,
  roleDefaultPermissions,
} from '@antagna/db';
import {
  AppShell,
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  Avatar,
} from '@antagna/ui';
import { Shield, Users, Bell, BarChart3, KeyRound } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  const [people, rules, kpis, permList, roleGrants] = await Promise.all([
    db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        email: profiles.email,
        role: profiles.role,
        status: profiles.status,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt))
      .limit(50),
    db
      .select()
      .from(alertRules)
      .orderBy(alertRules.key),
    db
      .select()
      .from(kpiDefinitions)
      .where(eq(kpiDefinitions.active, true))
      .orderBy(kpiDefinitions.scope, kpiDefinitions.key),
    db.select({ count: sql<number>`count(*)::int` }).from(permissions),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(roleDefaultPermissions),
  ]);

  return (
    <AppShell user={{ email: user.email ?? '' }} activePath="/admin">
      <PageHeader
        eyebrow="Admin"
        title="الإدارة"
        subtitle="المستخدمون، التنبيهات، KPIs، والأذونات"
      />

      {/* Quick stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminStat
          icon={<Users size={18} />}
          label="مستخدمين"
          value={people.length}
        />
        <AdminStat
          icon={<Bell size={18} />}
          label="قواعد التنبيه"
          value={rules.length}
          activeCount={rules.filter((r) => r.active).length}
        />
        <AdminStat
          icon={<BarChart3 size={18} />}
          label="KPI تعريف"
          value={kpis.length}
        />
        <AdminStat
          icon={<KeyRound size={18} />}
          label="أذونات"
          value={permList[0]?.count ?? 0}
          activeCount={roleGrants[0]?.count ?? 0}
          activeLabel="role grant"
        />
      </section>

      {/* Users */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="المستخدمون"
            subtitle={`${people.length} حساب`}
          />
        </div>
        {people.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="لا مستخدمين بعد"
            description="هيُنشأوا تلقائياً عند أول تسجيل دخول أو من Pillar 15 migration."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--line] bg-[--bg-elevated]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[--text-dim]">
                  <th className="px-5 py-3 text-start">الاسم</th>
                  <th className="px-5 py-3 text-start">البريد</th>
                  <th className="px-5 py-3 text-start">الدور</th>
                  <th className="px-5 py-3 text-start">الحالة</th>
                  <th className="px-5 py-3 text-start">تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--line]">
                {people.map((p) => (
                  <tr key={p.id} className="hover:bg-[--surface-hover]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.displayName} size="sm" />
                        <span className="text-[--text]">{p.displayName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[--text-muted]">
                      {p.email}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone="neutral">{p.role}</StatusPill>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        tone={p.status === 'active' ? 'success' : 'neutral'}
                      >
                        {p.status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[--text-dim]">
                      {new Date(p.createdAt).toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Alert rules */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="قواعد التنبيه"
            subtitle="بتشتغل عبر worker كل 5 دقايق"
          />
        </div>
        {rules.length === 0 ? (
          <EmptyState
            icon={<Bell size={20} />}
            title="لا توجد قواعد"
            description="ضيف قواعد من السكيمة لتفعيل التنبيهات."
          />
        ) : (
          <ul className="divide-y divide-[--line]">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 px-6 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[--text-dim]">
                      {r.key}
                    </span>
                    <StatusPill
                      tone={r.active ? 'success' : 'neutral'}
                      withDot={false}
                    >
                      {r.active ? 'active' : 'paused'}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-sm font-medium text-[--text]">
                    {r.nameAr}
                  </p>
                  {r.description && (
                    <p className="text-xs text-[--text-muted]">{r.description}</p>
                  )}
                </div>
                <div className="text-end text-xs text-[--text-dim]">
                  <p>{r.triggerType}</p>
                  <p className="font-mono">cooldown {r.cooldownMinutes}m</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* KPI definitions */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="تعريفات KPI"
            subtitle={`${kpis.length} تعريف نشط`}
          />
        </div>
        {kpis.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={20} />}
            title="لا KPIs"
            description=""
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--line] bg-[--bg-elevated]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[--text-dim]">
                  <th className="px-5 py-3 text-start">key</th>
                  <th className="px-5 py-3 text-start">الاسم</th>
                  <th className="px-5 py-3 text-start">scope</th>
                  <th className="px-5 py-3 text-start">unit</th>
                  <th className="px-5 py-3 text-start">refresh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--line]">
                {kpis.map((k) => (
                  <tr key={k.key} className="hover:bg-[--surface-hover]">
                    <td className="px-5 py-3.5 font-mono text-xs text-[--text-dim]">
                      {k.key}
                    </td>
                    <td className="px-5 py-3.5 text-[--text]">{k.nameAr}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone="info">{k.scope}</StatusPill>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[--text-muted]">
                      {k.unit}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[--text-muted]">
                      {k.refreshFrequency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <Shield className="text-[--accent]" size={20} />
          <div className="text-sm">
            <p className="text-[--text]">
              صلاحيات أعمق (إضافة users، تعديل alert rules، تعديل KPI defs) لسه read-only.
            </p>
            <p className="mt-1 text-xs text-[--text-muted]">
              هتُضاف لما تحدد سياسة الـ system_admin role في Pillar 3 الـ UI.
            </p>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}

function AdminStat({
  icon,
  label,
  value,
  activeCount,
  activeLabel = 'active',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  activeCount?: number;
  activeLabel?: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[--text-dim]">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-[--text]">
            {value}
          </p>
          {activeCount != null && (
            <p className="text-xs text-[--text-muted]">
              {activeCount} {activeLabel}
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--surface-hover] text-[--text-muted]">
          {icon}
        </div>
      </div>
    </Card>
  );
}
