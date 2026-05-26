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

type NavGroup = { heading?: string; items: NavItem[] };

// Grouped, labeled navigation — replaces the old floating icon-only pill.
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
      { href: '/projects', label: 'المشاريع', icon: Briefcase },
      { href: '/tasks', label: 'المهام', icon: ListChecks },
      { href: '/inbox', label: 'الوارد', icon: Inbox },
      { href: '/calendar', label: 'التقويم', icon: Calendar },
    ],
  },
  {
    heading: 'العمل',
    items: [
      { href: '/crm', label: 'العملاء', icon: Users },
      { href: '/equipment', label: 'المعدات', icon: Camera },
      { href: '/social', label: 'السوشيال', icon: Megaphone },
      { href: '/team', label: 'الفريق', icon: UserSquare2 },
    ],
  },
  {
    heading: 'التحليلات والإدارة',
    items: [
      { href: '/kpis', label: 'مؤشرات الأداء', icon: BarChart3 },
      { href: '/reports', label: 'التقارير', icon: FileText },
      { href: '/admin', label: 'الإدارة', icon: Shield },
      { href: '/settings', label: 'الإعدادات', icon: Settings },
    ],
  },
];

const PRIMARY_NAV = NAV_GROUPS[0]!.items;

function isActive(activePath: string | undefined, href: string): boolean {
  if (!activePath) return false;
  return href === '/dashboard' ? activePath === '/dashboard' : activePath.startsWith(href);
}

/** A labeled sidebar row (icon + text). */
function NavRow({ item, active, badge }: { item: NavItem; active: boolean; badge?: string | number }) {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      className={
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ' +
        (active
          ? 'bg-[var(--accent-tint)] text-[var(--text)]'
          : 'text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text)]')
      }
    >
      <Icon
        size={17}
        strokeWidth={1.7}
        className={active ? 'text-[var(--accent)]' : 'text-[var(--text-dim)] group-hover:text-[var(--text-muted)]'}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden />}
      {badge != null && (
        <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-1 font-mono text-[9px] font-semibold text-white">
          {badge}
        </span>
      )}
    </a>
  );
}

/** Compact icon-only button for the mobile bottom dock. */
function DockButton({ item, active, badge }: { item: NavItem; active: boolean; badge?: string | number }) {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      title={item.label}
      className={
        'group relative flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-colors ' +
        (active ? 'bg-[var(--accent-tint)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]')
      }
    >
      <span className="relative">
        <Icon size={18} strokeWidth={1.6} className={active ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'} />
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

function MobileMore({ activePath }: { activePath?: string }) {
  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]"
        title="المزيد"
      >
        <MoreHorizontal size={18} strokeWidth={1.6} className="text-[var(--text-dim)]" />
        <span className="text-[9px] leading-none">المزيد</span>
      </summary>
      <div
        className="absolute bottom-full start-1/2 mb-2 hidden min-w-[220px] -translate-x-1/2 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-2 shadow-2xl group-open:block"
        style={{ boxShadow: '0 20px 50px -10px rgba(0,0,0,0.6)' }}
      >
        {NAV_GROUPS.slice(1).map((g) => (
          <div key={g.heading}>
            {g.heading && (
              <p className="px-2 pb-1 pt-2 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">{g.heading}</p>
            )}
            <ul className="space-y-px">
              {g.items.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    className={
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] ' +
                      (isActive(activePath, href)
                        ? 'bg-[var(--accent-tint)] text-[var(--text)]'
                        : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]')
                    }
                  >
                    <Icon size={14} strokeWidth={1.6} className={isActive(activePath, href) ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'} />
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

const SIDEBAR_W = 248;

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
      {/* SIDEBAR — desktop, fixed to the visual right (RTL inline-start) */}
      <aside
        className="fixed bottom-0 top-0 z-40 hidden flex-col border-e border-[var(--line)] bg-[var(--surface)]/60 backdrop-blur md:flex"
        style={{ insetInlineStart: 0, width: SIDEBAR_W }}
        aria-label="القائمة الجانبية"
      >
        <a href="/dashboard" className="flex items-center gap-2.5 px-5" style={{ height: 'var(--topbar-h)' }}>
          <span
            className="grid h-7 w-7 place-items-center rounded-md font-bold text-white"
            style={{ background: 'var(--accent-gradient)', fontSize: 12 }}
          >
            A
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--text)]">Antagna</span>
        </a>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.heading ?? gi} className="space-y-0.5">
              {group.heading && (
                <p className="px-3 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--text-dim)]">
                  {group.heading}
                </p>
              )}
              {group.items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  active={isActive(activePath, item.href)}
                  badge={item.href === '/inbox' && unread > 0 ? unread : undefined}
                />
              ))}
            </div>
          ))}
        </nav>

        {user && (
          <div className="border-t border-[var(--line)] p-3">
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              <Avatar name={user.displayName ?? user.email ?? '?'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-[var(--text)]">{user.displayName ?? 'مرحباً'}</p>
                <p className="truncate text-[10px] text-[var(--text-dim)]">{user.email}</p>
              </div>
              <form action="/auth/logout" method="POST">
                <button
                  type="submit"
                  title="تسجيل خروج"
                  className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--danger)]"
                >
                  <LogOut size={13} />
                </button>
              </form>
            </div>
          </div>
        )}
      </aside>

      {/* CONTENT COLUMN */}
      <div className="md:ps-[248px]">
        {/* TOP BAR */}
        <header
          className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 backdrop-blur-md md:px-8"
          style={{ height: 'var(--topbar-h)' }}
        >
          {/* logo on mobile (sidebar hidden) */}
          <a href="/dashboard" className="flex items-center gap-2.5 md:hidden">
            <span className="grid h-7 w-7 place-items-center rounded-md font-bold text-white" style={{ background: 'var(--accent-gradient)', fontSize: 12 }}>A</span>
            <span className="text-[15px] font-semibold tracking-tight text-[var(--text)]">Antagna</span>
          </a>

          <div className="hidden flex-1 md:block">{commandPalette}</div>

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
              <NotificationsBell items={notifications} markAllReadAction={onMarkAllRead} markOneReadAction={onMarkOneRead} />
            )}
            {user && <Avatar name={user.displayName ?? user.email ?? '?'} size="sm" />}
          </div>
        </header>

        {/* CONTENT */}
        <main className="px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto max-w-[1680px] space-y-8">{children}</div>
        </main>
      </div>

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
        {PRIMARY_NAV.slice(0, 4).map((item) => (
          <DockButton
            key={item.href}
            item={item}
            active={isActive(activePath, item.href)}
            badge={item.href === '/inbox' && unread > 0 ? unread : undefined}
          />
        ))}
        <MobileMore activePath={activePath} />
      </nav>
    </div>
  );
}
