import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Camera,
  ListChecks,
  Inbox,
  BarChart3,
  Settings,
  Shield,
  Command,
  LogOut,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { Kbd } from './Kbd';
import { NotificationsBell, type NotificationItem } from './NotificationsBell';
import { MobileNav } from './MobileNav';

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: typeof LayoutDashboard }>;
}> = [
  {
    label: 'الرئيسية',
    items: [{ href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard }],
  },
  {
    label: 'العمل',
    items: [
      { href: '/projects', label: 'المشاريع', icon: Briefcase },
      { href: '/tasks', label: 'المهام', icon: ListChecks },
      { href: '/inbox', label: 'الوارد', icon: Inbox },
    ],
  },
  {
    label: 'الأصول',
    items: [
      { href: '/crm', label: 'العملاء', icon: Users },
      { href: '/equipment', label: 'المعدات', icon: Camera },
    ],
  },
  {
    label: 'القياس',
    items: [{ href: '/kpis', label: 'مؤشرات الأداء', icon: BarChart3 }],
  },
  {
    label: 'النظام',
    items: [
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
      <div className="flex h-16 items-center px-5">
        <a href="/dashboard" className="flex items-center gap-2.5 group">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[--accent] to-amber-300 text-black shadow-[0_8px_16px_-8px_rgba(245,214,10,0.6)]">
            <span className="text-sm font-black">A</span>
          </span>
          <span className="text-base font-semibold tracking-tight">Antagna</span>
        </a>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[--text-dim]">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = activePath?.startsWith(href);
                return (
                  <li key={href}>
                    <a
                      href={href}
                      className={
                        'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ' +
                        (active
                          ? 'bg-[--surface] text-[--text] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                          : 'text-[--text-muted] hover:bg-[--surface]/60 hover:text-[--text]')
                      }
                    >
                      <Icon
                        size={16}
                        className={
                          active
                            ? 'text-[--accent]'
                            : 'text-[--text-dim] group-hover:text-[--text-muted]'
                        }
                      />
                      <span>{label}</span>
                      {active && (
                        <span className="ms-auto h-1.5 w-1.5 rounded-full bg-[--accent]" />
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[--line] p-3">
        <div className="flex items-center gap-3 rounded-xl p-2 hover:bg-[--surface]/60">
          <Avatar name={user?.displayName ?? user?.email ?? '?'} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[--text]">
              {user?.displayName ?? 'مرحباً'}
            </p>
            <p className="truncate text-[11px] text-[--text-dim]">{user?.email}</p>
          </div>
          <form action="/auth/logout" method="POST">
            <button
              type="submit"
              title="تسجيل خروج"
              className="grid h-8 w-8 place-items-center rounded-lg text-[--text-dim] hover:bg-[--surface] hover:text-red-400"
            >
              <LogOut size={14} />
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
    <div className="flex min-h-screen bg-[--bg] text-[--text]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-l border-[--line] bg-[--bg-elevated]/60 backdrop-blur-2xl md:block">
        <div className="sticky top-0">
          <SidebarContent user={user} activePath={activePath} />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-[--line] bg-[--bg]/70 px-4 backdrop-blur-2xl md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <MobileNav>
              <SidebarContent user={user} activePath={activePath} />
            </MobileNav>
            <a href="/dashboard" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[--accent] to-amber-300 text-black">
                <span className="text-xs font-black">A</span>
              </span>
              <span className="font-semibold">Antagna</span>
            </a>
          </div>

          <div className="hidden items-center gap-2 text-xs text-[--text-dim] md:flex">
            {commandPalette ? (
              commandPalette
            ) : (
              <>
                <Command size={12} />
                <span>اضغط</span>
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
                <span>للبحث السريع</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ms-auto md:ms-0">
            {notifications && onMarkAllRead && onMarkOneRead && (
              <NotificationsBell
                items={notifications}
                markAllReadAction={onMarkAllRead}
                markOneReadAction={onMarkOneRead}
              />
            )}
            <span className="hidden truncate text-xs text-[--text-dim] lg:inline">
              {user?.email}
            </span>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-10">
          <div className="mx-auto max-w-7xl space-y-6 md:space-y-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
