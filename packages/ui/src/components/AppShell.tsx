import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  ListChecks,
  Inbox,
  Users,
  Camera,
  UserSquare2,
  Calendar,
  BarChart3,
  FileText,
  Shield,
  Settings,
  LogOut,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { NotificationsBell, type NotificationItem } from './NotificationsBell';
import { MobileNav } from './MobileNav';

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    soon?: boolean;
  }>;
}> = [
  {
    label: 'المساحة',
    items: [{ href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard }],
  },
  {
    label: 'العمليات',
    items: [
      { href: '/projects', label: 'المشاريع', icon: Briefcase },
      { href: '/tasks', label: 'المهام', icon: ListChecks },
      { href: '/inbox', label: 'الوارد', icon: Inbox },
      { href: '/crm', label: 'العملاء', icon: Users },
      { href: '/equipment', label: 'المعدات', icon: Camera },
      { href: '/team', label: 'الفريق', icon: UserSquare2, soon: true },
      { href: '/calendar', label: 'التقويم', icon: Calendar, soon: true },
    ],
  },
  {
    label: 'الأرشيف',
    items: [
      { href: '/kpis', label: 'مؤشرات الأداء', icon: BarChart3 },
      { href: '/reports', label: 'التقارير', icon: FileText, soon: true },
      { href: '/admin', label: 'الإدارة', icon: Shield },
      { href: '/settings', label: 'الإعدادات', icon: Settings },
    ],
  },
];

function SidebarContent({
  user,
  activePath,
}: {
  user?: { email: string; displayName?: string };
  activePath?: string;
}) {
  return (
    <div className="flex h-full min-h-screen flex-col">
      {/* Logo block */}
      <div className="px-5 pb-6 pt-5">
        <a href="/dashboard" className="block">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-[var(--text)]">
              Antagna
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
              v2
            </span>
          </div>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-dim)]">
            Volt Production · Jeddah
          </p>
        </a>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-7">
            <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
              — {group.label}
            </p>
            <ul className="space-y-px">
              {group.items.map(({ href, label, icon: Icon, soon }) => {
                const active = activePath?.startsWith(href);
                const itemCls =
                  'group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium ' +
                  (active
                    ? 'bg-[var(--surface)] text-[var(--text)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface)]/50 hover:text-[var(--text)]');
                const iconCls =
                  active
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-dim)] group-hover:text-[var(--text-muted)]';

                if (soon) {
                  return (
                    <li key={href}>
                      <span
                        aria-disabled="true"
                        className={itemCls + ' cursor-not-allowed opacity-50'}
                      >
                        <Icon size={15} strokeWidth={1.75} className={iconCls} />
                        <span>{label}</span>
                        <span className="ms-auto text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                          soon
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={href}>
                    <a href={href} className={itemCls}>
                      <Icon size={15} strokeWidth={1.75} className={iconCls} />
                      <span>{label}</span>
                      {active && (
                        <span className="ms-auto h-1 w-1 rounded-full bg-[var(--accent)]" />
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-[var(--line)] p-3">
        <div className="group flex items-center gap-3 rounded-md p-2 hover:bg-[var(--surface)]/40">
          <Avatar
            name={user?.displayName ?? user?.email ?? '?'}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-[var(--text)]">
              {user?.displayName ?? 'Antagna user'}
            </p>
            <p className="truncate text-[10px] text-[var(--text-dim)]">
              {user?.email}
            </p>
          </div>
          <form action="/auth/logout" method="POST">
            <button
              type="submit"
              title="تسجيل خروج"
              className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-[var(--surface)] hover:text-[var(--danger)]"
            >
              <LogOut size={13} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  user,
  activePath,
  notifications,
  onMarkAllRead,
  onMarkOneRead,
  commandPalette,
}: {
  children: ReactNode;
  user?: { email: string; displayName?: string };
  activePath?: string;
  notifications?: NotificationItem[];
  onMarkAllRead?: () => Promise<void> | void;
  onMarkOneRead?: (id: string) => Promise<void> | void;
  commandPalette?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Sidebar — 232px, right side (RTL) */}
      <aside
        className="hidden shrink-0 border-l border-[var(--line)] bg-[var(--bg-elevated)]/40 backdrop-blur-2xl md:block"
        style={{ width: 232 }}
      >
        <div className="sticky top-0">
          <SidebarContent user={user} activePath={activePath} />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--bg)]/80 px-4 backdrop-blur-2xl md:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <MobileNav>
              <SidebarContent user={user} activePath={activePath} />
            </MobileNav>
            <a href="/dashboard" className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tracking-tight">
                Antagna
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                v2
              </span>
            </a>
          </div>

          <div className="hidden md:block">{commandPalette}</div>

          <div className="flex items-center gap-2 ms-auto md:ms-0">
            {notifications && onMarkAllRead && onMarkOneRead && (
              <NotificationsBell
                items={notifications}
                markAllReadAction={onMarkAllRead}
                markOneReadAction={onMarkOneRead}
              />
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-8 md:px-12 md:py-12">
          <div className="mx-auto max-w-[1400px] space-y-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
