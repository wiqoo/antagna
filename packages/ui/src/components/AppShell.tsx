import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  ListChecks,
  Inbox,
  Users,
  Contact,
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
  Clock,
  MessageCircle,
  Sun,
  Bell,
  CheckCircle2,
  Wrench,
  FolderArchive,
  CalendarDays,
  IdCard,
  Search,
  History,
  ShoppingCart,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { NotificationsBell, type NotificationItem } from './NotificationsBell';

type NavItem = {
  href: string;
  key: string;        // i18n key under "nav"
  label: string;      // fallback (Arabic) when no labels prop is passed
  icon: typeof LayoutDashboard;
};

type NavGroup = { headingKey?: string; heading?: string; items: NavItem[] };

/** Translated labels passed in from the app (keeps this UI package free of an
 * i18n dependency). Keys mirror the `nav` message namespace. */
export type NavLabels = Record<string, string>;

// Grouped, labeled navigation — replaces the old floating icon-only pill.
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/my-day', key: 'myDay', label: 'يومي', icon: Sun },
      { href: '/dashboard', key: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
      { href: '/search', key: 'search', label: 'بحث', icon: Search },
      { href: '/projects', key: 'projects', label: 'المشاريع', icon: Briefcase },
      { href: '/tasks', key: 'tasks', label: 'المهام', icon: ListChecks },
      { href: '/inbox', key: 'inbox', label: 'الوارد', icon: Inbox },
      { href: '/approvals', key: 'approvals', label: 'الاعتمادات', icon: CheckCircle2 },
      { href: '/notifications', key: 'notifications', label: 'الإشعارات', icon: Bell },
      { href: '/calendar', key: 'calendar', label: 'التقويم', icon: Calendar },
    ],
  },
  {
    headingKey: 'groupWork', heading: 'العمل',
    items: [
      { href: '/crm', key: 'clients', label: 'العملاء', icon: Users },
      { href: '/contacts', key: 'contacts', label: 'جهات الاتصال', icon: Contact },
      { href: '/equipment', key: 'equipment', label: 'المعدات', icon: Camera },
      { href: '/orders', key: 'orders', label: 'أوامر الشراء', icon: ShoppingCart },
      { href: '/equipment/repairs', key: 'repairs', label: 'الصيانة', icon: Wrench },
      { href: '/assets', key: 'assets', label: 'أصول الشركة', icon: FolderArchive },
      { href: '/social', key: 'social', label: 'السوشيال', icon: Megaphone },
      { href: '/team', key: 'team', label: 'الفريق', icon: UserSquare2 },
      { href: '/employees', key: 'employees', label: 'الموظفون', icon: IdCard },
      { href: '/meetings', key: 'meetings', label: 'الاجتماعات', icon: CalendarDays },
      { href: '/attendance', key: 'attendance', label: 'الحضور', icon: Clock },
      { href: '/whatsapp', key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    ],
  },
  {
    headingKey: 'groupAnalytics', heading: 'التحليلات والإدارة',
    items: [
      { href: '/kpis', key: 'kpis', label: 'مؤشرات الأداء', icon: BarChart3 },
      { href: '/reports', key: 'reports', label: 'التقارير', icon: FileText },
      { href: '/changelog', key: 'changelog', label: 'سجل التغييرات', icon: History },
      { href: '/admin', key: 'admin', label: 'الإدارة', icon: Shield },
      { href: '/settings', key: 'settings', label: 'الإعدادات', icon: Settings },
    ],
  },
];

const PRIMARY_NAV = NAV_GROUPS[0]!.items;

// Which primary items get a slot in the mobile bottom dock. Inbox earns a slot
// (core daily surface + carries the unread badge); search drops to ⌘K + the
// "more" drawer. Everything not docked goes to the drawer's overflow block so
// nothing in the primary group is unreachable on mobile.
const DOCK_HREFS = ['/my-day', '/dashboard', '/inbox', '/projects'];
const DOCK_NAV: NavItem[] = DOCK_HREFS.map(
  (h) => PRIMARY_NAV.find((i) => i.href === h)!,
).filter(Boolean);
const PRIMARY_OVERFLOW: NavItem[] = PRIMARY_NAV.filter(
  (i) => !DOCK_HREFS.includes(i.href),
);

// Permission-filter the nav: a clearly-privileged item is shown only when the
// user holds ANY of its keys. Core daily items (my-day/dashboard/search/tasks/
// approvals/notifications/calendar/meetings/attendance/social/changelog/
// settings) are intentionally NOT listed → always visible (the page itself
// still gates writes/financials). Conservative on purpose: better to show one
// extra link than to hide a tool from someone who needs it.
const NAV_PERM: Record<string, string[]> = {
  inbox: ['email_threads.read.all', 'email_threads.read.assigned'],
  whatsapp: ['whatsapp.send', 'email_threads.read.all', 'email_threads.read.assigned'],
  clients: ['client.read', 'clients.read.all', 'clients.read.own'],
  contacts: ['client.read', 'clients.read.contacts'],
  equipment: ['equipment.read'],
  repairs: ['equipment.read'],
  assets: ['equipment.read'],
  orders: ['procurement.manage'],
  team: ['team.read'],
  employees: ['team.read'],
  kpis: ['financials.read', 'projects.read.all'],
  reports: ['financials.read'],
  admin: ['access.manage'],
};

/** All permission keys referenced by the nav — Shell evaluates these once. */
export const NAV_PERM_KEYS: string[] = [...new Set(Object.values(NAV_PERM).flat())];

/** An item is visible when it has no perm requirement, when permits weren't
 *  provided (fail-open during load), or when the user holds ANY required key. */
function navItemVisible(key: string, permits?: Record<string, boolean>): boolean {
  const req = NAV_PERM[key];
  if (!req) return true;
  if (!permits) return true;
  return req.some((k) => permits[k]);
}

/** Resolve an item/heading label from the optional labels map, else fallback. */
function lbl(labels: NavLabels | undefined, key: string | undefined, fallback: string): string {
  return (key && labels?.[key]) || fallback;
}

function isActive(activePath: string | undefined, href: string): boolean {
  if (!activePath) return false;
  if (href === '/dashboard') return activePath === '/dashboard';
  // /equipment must not steal the highlight from its more-specific sibling
  // /equipment/repairs (which is its own nav item).
  if (href === '/equipment') {
    return activePath.startsWith('/equipment') && !activePath.startsWith('/equipment/repairs');
  }
  return activePath.startsWith(href);
}

/** A labeled sidebar row (icon + text). */
function NavRow({ item, label, active, badge }: { item: NavItem; label: string; active: boolean; badge?: string | number }) {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      className={
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ' +
        (active
          ? 'bg-[var(--accent-tint)] text-[var(--text)]'
          : 'text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text)]')
      }
    >
      {active && (
        <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-[var(--accent)]" aria-hidden />
      )}
      <Icon
        size={17}
        strokeWidth={1.7}
        className={
          'transition-transform group-hover:scale-110 ' +
          (active ? 'text-[var(--accent)]' : 'text-[var(--text-dim)] group-hover:text-[var(--text-muted)]')
        }
      />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && (
        <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-1 font-mono text-[9px] font-semibold text-white">
          {badge}
        </span>
      )}
    </a>
  );
}

/** Compact icon-only button for the mobile bottom dock. */
function DockButton({ item, label, active, badge }: { item: NavItem; label: string; active: boolean; badge?: string | number }) {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      title={label}
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
      <span className="text-[9px] leading-none">{label}</span>
    </a>
  );
}

function MobileMore({ activePath, labels, permits }: { activePath?: string; labels?: NavLabels; permits?: Record<string, boolean> }) {
  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]"
        title={lbl(labels, 'more', 'المزيد')}
      >
        <MoreHorizontal size={18} strokeWidth={1.6} className="text-[var(--text-dim)]" />
        <span className="text-[9px] leading-none">{lbl(labels, 'more', 'المزيد')}</span>
      </summary>
      {/* Anchored to the viewport (not the trigger), so the popover always sits
          centered above the bottom dock regardless of which item triggers it.
          Mohammed's audit hit this on iPhone — the popover was spilling off the
          left side of the screen when "More" was the leftmost RTL item. */}
      <div
        className="fixed bottom-[82px] left-1/2 z-[120] hidden max-h-[70vh] min-w-[260px] max-w-[min(92vw,360px)] -translate-x-1/2 overflow-y-auto rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-2 shadow-2xl group-open:block"
        style={{ boxShadow: '0 20px 50px -10px rgba(0,0,0,0.6)' }}
      >
        {/* The bottom dock only fits 4 primary items; the rest (search, tasks,
            approvals, notifications, calendar) would be UNREACHABLE on mobile
            without this overflow block. Render it first, then the named groups. */}
        {[
          { headingKey: undefined, heading: undefined, items: PRIMARY_OVERFLOW },
          ...NAV_GROUPS.slice(1),
        ]
          .map((g) => ({ ...g, items: g.items.filter((it) => navItemVisible(it.key, permits)) }))
          .filter((g) => g.items.length > 0)
          .map((g, gi) => (
          <div key={g.headingKey ?? gi}>
            {g.heading && (
              <p className="px-2 pb-1 pt-2 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">{lbl(labels, g.headingKey, g.heading)}</p>
            )}
            <ul className="space-y-px">
              {g.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className={
                        'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] ' +
                        (isActive(activePath, item.href)
                          ? 'bg-[var(--accent-tint)] text-[var(--text)]'
                          : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]')
                      }
                    >
                      <Icon size={14} strokeWidth={1.6} className={isActive(activePath, item.href) ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'} />
                      <span>{lbl(labels, item.key, item.label)}</span>
                    </a>
                  </li>
                );
              })}
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
  labels,
  localeSwitch,
  permits,
}: {
  children: ReactNode;
  user?: { email: string; displayName?: string };
  activePath?: string;
  notifications?: NotificationItem[];
  onMarkAllRead?: () => Promise<void> | void;
  onMarkOneRead?: (id: string) => Promise<void> | void;
  commandPalette?: ReactNode;
  /** Translated labels (nav keys + newProject/more/logout/sidebar). From the app. */
  labels?: NavLabels;
  localeSwitch?: ReactNode;
  /** Map of nav-permission key → granted, from Shell (canMany(NAV_PERM_KEYS)).
   *  Undefined → fail-open (show everything). */
  permits?: Record<string, boolean>;
}) {
  const unread = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="page-main bg-[var(--bg)] text-[var(--text)]">
      {/* SIDEBAR — desktop, fixed to the visual right (RTL inline-start) */}
      <aside
        className="fixed bottom-0 top-0 z-40 hidden flex-col border-e border-[var(--line)] bg-[var(--surface)]/60 backdrop-blur md:flex"
        style={{ insetInlineStart: 0, width: SIDEBAR_W }}
        aria-label={lbl(labels, 'sidebar', 'القائمة الجانبية')}
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
          {NAV_GROUPS
            .map((group) => ({ ...group, items: group.items.filter((it) => navItemVisible(it.key, permits)) }))
            .filter((group) => group.items.length > 0)
            .map((group, gi) => (
            <div key={group.headingKey ?? gi} className="space-y-0.5">
              {group.heading && (
                <p className="px-3 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--text-dim)]">
                  {lbl(labels, group.headingKey, group.heading)}
                </p>
              )}
              {group.items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  label={lbl(labels, item.key, item.label)}
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
                  aria-label="تسجيل خروج"
                  className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--danger)]"
                >
                  <LogOut size={13} />
                </button>
              </form>
            </div>
          </div>
        )}
      </aside>

      {/* CONTENT COLUMN — margin (not padding) reserves the fixed-sidebar gutter,
          min-w-0 lets the column shrink below its content, and overflow-x-clip
          stops any wide child (tables, matrices) from sliding UNDER the sidebar
          and forcing a page-wide horizontal scroll. clip (not hidden) keeps the
          sticky topbar working. */}
      <div className="min-w-0 overflow-x-clip md:ms-[248px]">
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
              title={lbl(labels, 'newProject', 'مشروع')}
              className="hidden h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold text-white hover:opacity-90 md:inline-flex"
              style={{ background: 'var(--accent-gradient)' }}
            >
              <Plus size={13} />
              {lbl(labels, 'newProject', 'مشروع')}
            </a>
            {localeSwitch}
            {notifications && onMarkAllRead && onMarkOneRead && (
              <NotificationsBell items={notifications} markAllReadAction={onMarkAllRead} markOneReadAction={onMarkOneRead} />
            )}
            {user && <Avatar name={user.displayName ?? user.email ?? '?'} size="sm" />}
          </div>
        </header>

        {/* CONTENT */}
        <main className="min-w-0 px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto min-w-0 max-w-[1680px] space-y-8">{children}</div>
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
        aria-label={lbl(labels, 'bottomNav', 'شريط التنقّل')}
      >
        {DOCK_NAV.filter((item) => navItemVisible(item.key, permits)).map((item) => (
          <DockButton
            key={item.href}
            item={item}
            label={lbl(labels, item.key, item.label)}
            active={isActive(activePath, item.href)}
            badge={item.href === '/inbox' && unread > 0 ? unread : undefined}
          />
        ))}
        <MobileMore activePath={activePath} labels={labels} permits={permits} />
      </nav>
    </div>
  );
}
