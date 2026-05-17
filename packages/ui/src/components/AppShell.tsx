import type { ReactNode } from 'react';
import {
  Home,
  Users,
  Briefcase,
  Camera,
  ListTodo,
  Inbox,
  BarChart3,
  Settings,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',  label: 'Home',      icon: Home },
  { href: '/crm',        label: 'CRM',       icon: Users },
  { href: '/projects',   label: 'Projects',  icon: Briefcase },
  { href: '/equipment',  label: 'Equipment', icon: Camera },
  { href: '/tasks',      label: 'Tasks',     icon: ListTodo },
  { href: '/inbox',      label: 'Inbox',     icon: Inbox },
  { href: '/kpis',       label: 'KPIs',      icon: BarChart3 },
  { href: '/admin',      label: 'Admin',     icon: Settings },
];

export function AppShell({
  children,
  user,
  activePath,
}: {
  children: ReactNode;
  user?: { email: string };
  activePath?: string;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      {/* Sidebar */}
      <aside className="hidden w-[200px] flex-shrink-0 border-r border-neutral-800 md:block">
        <div className="flex h-12 items-center border-b border-neutral-800 px-4">
          <span className="font-mono text-sm font-semibold tracking-wide">
            <span className="text-yellow-500">ANTAGNA</span>
          </span>
        </div>
        <nav className="px-2 py-3">
          <ul className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = activePath?.startsWith(href);
              return (
                <li key={href}>
                  <a
                    href={href}
                    className={[
                      'flex items-center gap-3 rounded-sm px-3 py-2 text-sm',
                      active
                        ? 'bg-neutral-800 text-neutral-100'
                        : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100',
                    ].join(' ')}
                  >
                    <Icon size={14} />
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-4">
          <div className="text-xs text-neutral-500" />
          <div className="flex items-center gap-3">
            {user && <span className="font-mono text-xs text-neutral-400">{user.email}</span>}
            <form action="/auth/logout" method="POST">
              <button
                type="submit"
                className="rounded-sm border border-neutral-800 px-2 py-1 text-xs hover:border-yellow-500"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
