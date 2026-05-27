import Link from 'next/link';
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

  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  Avatar,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Shield, Users, Bell, BarChart3, KeyRound, Sparkles, Power, SlidersHorizontal, ChevronLeft } from 'lucide-react';
import { getAdminUser } from '@/lib/auth-admin';
import { seedDevData } from './seed-actions';
import { toggleAlertRule, updateAlertCooldown, toggleKpi } from './alert-actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin');
  const user = admin.user;

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

  const inactiveUsers = people.filter((p) => p.status !== 'active').length;
  const disabledRules = rules.filter((r) => !r.active).length;
  const inactiveKpis = kpis.filter((k) => !k.active).length;

  const hints: AIHint[] = [];
  if (disabledRules > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${disabledRules} قاعدة تنبيه معطّلة`,
      insight: 'تأكد من تفعيل القواعد المهمة لتلقي الإشعارات في الوقت المناسب.',
    });
  }
  if (inactiveKpis > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${inactiveKpis} مؤشر أداء غير نشط`,
      insight: 'فعّل المؤشرات المطلوبة أو احذف القديمة.',
    });
  }
  if (inactiveUsers > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${inactiveUsers} مستخدم بحالة غير نشطة`,
      insight: 'راجع المستخدمين المعلّقين — تفعيل أو حذف.',
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/admin">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · الإدارة"
          headline={`${people.length} مستخدم · ${rules.length} تنبيه · ${kpis.length} مؤشر`}
          hints={hints}
          compact
        />
      )}
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

      {/* Advanced management tools */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AdminToolLink
          href="/admin/access"
          icon={<KeyRound size={18} />}
          title="الأدوار والصلاحيات"
          subtitle="تحكّم دقيق لكل إجراء + استثناءات وقدرات لكل مستخدم"
        />
        <AdminToolLink
          href="/admin/automation"
          icon={<SlidersHorizontal size={18} />}
          title="قواعد التنبيهات والمؤشرات"
          subtitle="حرّر منطق المراقبة — التنبيهات وحدود مؤشرات الأداء"
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
                <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">الاسم</th>
                  <th className="px-5 py-3 text-start">البريد</th>
                  <th className="px-5 py-3 text-start">الدور</th>
                  <th className="px-5 py-3 text-start">الحالة</th>
                  <th className="px-5 py-3 text-start">تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {people.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--surface-hover)]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.displayName} size="sm" />
                        <span className="text-[var(--text)]">{p.displayName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-muted)]">
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
                    <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">
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
            subtitle="تعمل عبر worker كل 5 دقائق · للتحرير الكامل: قواعد التنبيهات والمؤشرات"
          />
        </div>
        {rules.length === 0 ? (
          <EmptyState
            icon={<Bell size={20} />}
            title="لا توجد قواعد"
            description="ضيف قواعد من السكيمة لتفعيل التنبيهات."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 px-6 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[var(--text-dim)]">
                      {r.key}
                    </span>
                    <StatusPill
                      tone={r.active ? 'success' : 'neutral'}
                      withDot={false}
                    >
                      {r.active ? 'active' : 'paused'}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-sm font-medium text-[var(--text)]">
                    {r.nameAr}
                  </p>
                  {r.description && (
                    <p className="text-xs text-[var(--text-muted)]">{r.description}</p>
                  )}
                </div>
                <form action={updateAlertCooldown} className="flex items-center gap-2 text-xs">
                  <input type="hidden" name="ruleId" value={r.id} />
                  <span className="text-[var(--text-dim)]">cooldown</span>
                  <input
                    type="number"
                    name="cooldownMinutes"
                    defaultValue={r.cooldownMinutes}
                    min={1}
                    className="h-7 w-16 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-end font-mono text-xs"
                  />
                  <span className="text-[var(--text-dim)]">min</span>
                  <button
                    type="submit"
                    className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[10px] hover:border-[var(--accent)]"
                  >
                    حفظ
                  </button>
                </form>
                <form action={toggleAlertRule.bind(null, r.id)}>
                  <button
                    type="submit"
                    title={r.active ? 'إيقاف' : 'تفعيل'}
                    className={
                      'grid h-8 w-8 place-items-center rounded-md border ' +
                      (r.active
                        ? 'border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]'
                        : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)]')
                    }
                  >
                    <Power size={12} />
                  </button>
                </form>
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
                <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">key</th>
                  <th className="px-5 py-3 text-start">الاسم</th>
                  <th className="px-5 py-3 text-start">scope</th>
                  <th className="px-5 py-3 text-start">unit</th>
                  <th className="px-5 py-3 text-start">refresh</th>
                  <th className="px-5 py-3 text-start"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {kpis.map((k) => (
                  <tr key={k.key} className="hover:bg-[var(--surface-hover)]">
                    <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">
                      {k.key}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text)]">{k.nameAr}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone="info">{k.scope}</StatusPill>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[var(--text-muted)]">
                      {k.unit}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[var(--text-muted)]">
                      {k.refreshFrequency}
                    </td>
                    <td className="px-5 py-3.5">
                      <form action={toggleKpi.bind(null, k.key)}>
                        <button
                          type="submit"
                          className={
                            'grid h-7 w-7 place-items-center rounded-md border ' +
                            (k.active
                              ? 'border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]'
                              : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)]')
                          }
                        >
                          <Power size={11} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>


      <Card className="border-[var(--accent)]/30 bg-[var(--accent)]/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="text-[var(--accent)]" size={20} />
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Demo data</p>
              <p className="text-xs text-[var(--text-muted)]">
                يضيف 5 عملاء + 9 معدات + 5 مشاريع + 3 leads لاختبار الـ UI.
                Idempotent — آمن تشغّله أكتر من مرة.
              </p>
            </div>
          </div>
          <form action={seedDevData}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Sparkles size={14} />
              تشغيل
            </button>
          </form>
        </div>
      </Card>
    </Shell>
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
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-dim)]">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            {value}
          </p>
          {activeCount != null && (
            <p className="text-xs text-[var(--text-muted)]">
              {activeCount} {activeLabel}
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)]">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function AdminToolLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]/50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)] group-hover:text-[var(--accent)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--text)]">{title}</p>
        <p className="truncate text-xs text-[var(--text-muted)]">{subtitle}</p>
      </div>
      <ChevronLeft
        size={16}
        className="shrink-0 text-[var(--text-dim)] transition-transform group-hover:-translate-x-0.5 group-hover:text-[var(--accent)]"
      />
    </Link>
  );
}
