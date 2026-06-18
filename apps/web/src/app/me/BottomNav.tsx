'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/me', label: 'النهارده', icon: '☀️', match: (p: string) => p === '/me' },
  { href: '/me/inbox', label: 'الوارد', icon: '📥', match: (p: string) => p.startsWith('/me/inbox') },
  { href: '/me/projects', label: 'المشاريع', icon: '📁', match: (p: string) => p.startsWith('/me/projects') },
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
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px]"
            style={{ color: active ? 'var(--accent)' : 'var(--text-dim)' }}
          >
            <span className="text-[18px] leading-none">{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
