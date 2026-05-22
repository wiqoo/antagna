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
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { NotificationsBell, type NotificationItem } from './NotificationsBell';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/projects', label: 'المشاريع', icon: Briefcase },
  { href: '/tasks', label: 'المهام', icon: ListChecks },
  { href: '/inbox', label: 'الوارد', icon: Inbox },
  { href: '/calendar', label: 'التقويم', icon: Calendar },
];

const SECONDARY_NAV: NavItem[] = [
  { href: '/crm', label: 'العملاء', icon: Users },
  { href: '/equipment', label: 'المعدات', icon: Camera },
  { href: '/social', label: 'السوشيال', icon: Megaphone },
  { href: '/team', label: 'الفريق', icon: UserSquare2 },
  { href: '/kpis', label: 'مؤشرات الأداء', icon: BarChart3 },
  { href: '/reports', label: 'التقارير', icon: FileText },
  { href: '/admin', label: 'الإدارة', icon: Shield },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

function DockButton({
  item,
  active,
  badge,
}: {
  item: NavItem;
  active: boolean;
  badge?: string | number;
}) {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      title={item.label}
      className={
        'group relative flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2.5 transition-colors ' +
        (active
          ? 'bg-[var(--accent-tint)] text-[var(--text)]'
          : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]')
      }
    >
      <span className="relative">
        <Icon
          size={18}
          strokeWidth={1.6}
          className={active ? 'text-[var(--accent)]' : 'text-[var(--text-dim)] group-hover:text-[var(--text-muted)]'}
        />
        {badge != null && (
          <span className="absolute -end-2 -top-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[var(--accent)] px-1 font-mono text-[9px] font-semibold text-white">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[9px] leading-none">{item.label}</span>
    </a>
  );
}

function MoreMenu({
  activePath,
  user,
}: {
  activePath?: string;
  user?: { email: string; displayName?: string };
}) {
  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl px-3 py-2.5 text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]"
        title="المزيد"
      >
        <MoreHorizontal size={18} strokeWidth={1.6} className="text-[var(--text-dim)]" />
        <span className="text-[9px] leading-none">المزيد</span>
      </summary>
      <div
        className="absolute end-0 bottom-full mb-2 hidden min-w-[200px] rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-2 shadow-2xl group-open:block md:bottom-auto md:top-0 md:end-full md:me-2 md:mb-0"
        style={{ boxShadow: '0 20px 50px -10px rgba(0,0,0,0.6)' }}
      >
        <ul className="space-y-px">
          {SECONDARY_NAV.map(({ href, label, icon: Icon }) => {
            const active = activePath?.startsWith(href) ?? false;
            return (
              <li key={href}>
                <a
                  href={href}
                  className={
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] ' +
                    (active
                      ? 'bg-[var(--accent-tint)] text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]')
                  }
                >
                  <Icon size={14} strokeWidth={1.6} className={active ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'} />
                  <span>{label}</span>
                </a>
              </li>
            );
          })}
        </ul>
        {user && (
          <>
            <div className="my-2 h-px bg-[var(--line)]" />
            <div className="flex items-center gap-2 rounded-md px-2 py-2">
              <Avatar name={user.displayName ?? user.email ?? '?'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-[var(--text)]">
                  {user.displayName ?? 'مرحباً'}
                </p>
                <p className="truncate text-[10px] text-[var(--text-dim)]">{user.email}</p>
              </div>
              <form action="/auth/logout" method="POST">
                <button
                  type="submit"
                  title="تسجيل خروج"
                  className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--danger)]"
                >
                  <LogOut size={12} />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </details>
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
  const unread = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="page-main bg-[var(--bg)] text-[var(--text)]">
      {/* TOP BAR */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 backdrop-blur-md md:px-6"
        style={{ height: 'var(--topbar-h)' }}
      >
        <a href="/dashboard" className="flex items-center gap-2.5">
          <span
            className="grid h-7 w-7 place-items-center rounded-md font-bold text-white"
            style={{ background: 'var(--accent-gradient)', fontSize: 12 }}
          >
            A
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
            Antagna
          </span>
        </a>

        <div className="ms-6 hidden flex-1 md:block">{commandPalette}</div>

        <div className="ms-auto flex items-center gap-2">
          <a
            href="/projects/new"
            title="مشروع جديد"
            className="hidden h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold text-white hover:opacity-90 md:inline-flex"
            style={{ background: 'var(--accent-gradient)' }}
          >
            <Plus size={13} />
            مشروع
          </a>

          {notifications && onMarkAllRead && onMarkOneRead && (
            <NotificationsBell
              items={notifications}
              markAllReadAction={onMarkAllRead}
              markOneReadAction={onMarkOneRead}
            />
          )}

          {user && (
            <Avatar name={user.displayName ?? user.email ?? '?'} size="sm" />
          )}
        </div>
      </header>

      {/* CONTENT */}
      <main className="px-4 py-6 md:px-8 md:py-8 md:ps-[110px]">
        <div className="mx-auto max-w-[1200px] space-y-8">{children}</div>
      </main>

      {/* SIDE DOCK — desktop, fixed to the visual right (RTL start) */}
      <nav
        className="fixed top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-1 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)]/95 p-1.5 backdrop-blur md:flex"
        style={{
          insetInlineStart: 16,
          boxShadow: '0 20px 50px -10px rgba(0,0,0,0.5)',
        }}
        aria-label="الملاحة الجانبية"
      >
        {PRIMARY_NAV.map((item) => {
          const active = activePath
            ? item.href === '/dashboard'
              ? activePath === '/dashboard'
              : activePath.startsWith(item.href)
            : false;
          const badge = item.href === '/inbox' && unread > 0 ? unread : undefined;
          return (
            <DockButton key={item.href} item={item} active={active} badge={badge} />
          );
        })}
        <div className="my-1 h-px bg-[var(--line)]" />
        <MoreMenu activePath={activePath} user={user} />
      </nav>

      {/* BOTTOM DOCK — mobile */}
      <nav
        className="fixed z-30 flex gap-1 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)]/95 p-1.5 backdrop-blur md:hidden"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 'calc(12px + env(safe-area-inset-bottom))',
          boxShadow: '0 20px 50px -10px rgba(0,0,0,0.6)',
        }}
        aria-label="الملاحة السفلية"
      >
        {PRIMARY_NAV.slice(0, 4).map((item) => {
          const active = activePath
            ? item.href === '/dashboard'
              ? activePath === '/dashboard'
              : activePath.startsWith(item.href)
            : false;
          const badge = item.href === '/inbox' && unread > 0 ? unread : undefined;
          return (
            <DockButton key={item.href} item={item} active={active} badge={badge} />
          );
        })}
        <MoreMenu activePath={activePath} user={user} />
      </nav>
    </div>
  );
}
