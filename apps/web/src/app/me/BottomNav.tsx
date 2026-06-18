'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MORE_ROUTES = ['/me/more', '/me/inbox', '/me/projects', '/me/waiting', '/me/recurring', '/me/notes', '/me/growth', '/me/review', '/me/ask'];

const items = [
  { href: '/me', label: 'اليوم', icon: '☀️', match: (p: string) => p === '/me' || p.startsWith('/me/calendar') },
  { href: '/me/assistant', label: 'مساعدك', icon: '💬', match: (p: string) => p.startsWith('/me/assistant') },
  { href: '/me/money', label: 'الفلوس', icon: '💰', match: (p: string) => p.startsWith('/me/money') },
  { href: '/me/insights', label: 'رؤى', icon: '📊', match: (p: string) => p.startsWith('/me/insights') },
  { href: '/me/more', label: 'المزيد', icon: '⋯', match: (p: string) => MORE_ROUTES.some((x) => p.startsWith(x)) },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-stretch border-t border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur">
      {items.map((it) => {
        const active = it.match(path);
        return (
          <Link
            key={it.href}
            href={it.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px]"
            style={{ color: active ? 'var(--accent)' : 'var(--text-dim)' }}
          >
            <span className="text-[17px] leading-none">{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
