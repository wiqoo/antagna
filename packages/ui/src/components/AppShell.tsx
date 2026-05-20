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
  Megaphone,
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
      { href: '/social', label: 'السوشيال ميديا', icon: Megaphone },
      { href: '/team', label: 'الفريق', icon: UserSquare2 },
      { href: '/calendar', label: 'التقويم', icon: Calendar },
    ],
  },
  {
    label: 'الأرشيف',
    items: [
      { href: '/kpis', label: 'مؤشرات الأداء', icon: BarChart3 },
      { href: '/reports', label: 'التقارير', icon: FileText },
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
      {/* Logo block — small, restrained */}
      <div className="px-4 pb-5 pt-5">
        <a href="/dashboard" className="block">
          <span className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
            Antagna
          </span>
        </a>
      </div>

      {/* Nav — Notion-style: tiny labels, generous spacing */}
      <nav className="flex-1 overflow-y-auto px-2 pb-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium text-[var(--text-dim)]">
              {group.label}
            </p>
            <ul className="space-y-px">
              {group.items.map(({ href, label, icon: Icon, soon }) => {
                const active = activePath?.startsWith(href);
                const itemCls =
                  'group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] ' +
                  (active
                    ? 'bg-[var(--surface)] text-[var(--text)] font-medium'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface)]/70 hover:text-[var(--text)]');
                const iconCls = 'text-[var(--text-dim)]';

                if (soon) {
                  return (
                    <li key={href}>
                      <span
                        aria-disabled="true"
                        className={itemCls + ' cursor-not-allowed opacity-50'}
                      >
                        <Icon size={14} strokeWidth={1.5} className={iconCls} />
                        <span>{label}</span>
                        <span className="ms-auto text-[9px] text-[var(--text-dim)]">
                          قريباً
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={href}>
                    <a href={href} className={itemCls}>
                      <Icon size={14} strokeWidth={1.5} className={iconCls} />
                      <span>{label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-[var(--line)] p-2">
        <div className="group flex items-center gap-2 rounded-md p-2 hover:bg-[var(--surface)]/70">
          <Avatar
            name={user?.displayName ?? user?.email ?? '?'}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] text-[var(--text)]">
              {user?.displayName ?? 'مرحباً'}
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
              <LogOut size={12} />
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
      {/* Sidebar — 240px, right side (RTL) — no glass, just subtle surface */}
      <aside
        className="hidden shrink-0 border-l border-[var(--line)] bg-[var(--bg)] md:block"
        style={{ width: 240 }}
      >
        <div className="sticky top-0">
          <SidebarContent user={user} activePath={activePath} />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Top bar — minimal, just nav + search */}
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--bg)] px-4 md:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <MobileNav>
              <SidebarContent user={user} activePath={activePath} />
            </MobileNav>
            <a href="/dashboard" className="text-[14px] font-semibold tracking-tight">
              Antagna
            </a>
          </div>

          <div className="hidden md:block">{commandPalette}</div>

          <div className="flex items-center gap-1 ms-auto md:ms-0">
            {notifications && onMarkAllRead && onMarkOneRead && (
              <NotificationsBell
                items={notifications}
                markAllReadAction={onMarkAllRead}
                markOneReadAction={onMarkOneRead}
              />
            )}
          </div>
        </header>

        <main className="flex-1 px-5 py-10 md:px-16 md:py-16">
          <div className="mx-auto max-w-[860px] space-y-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
