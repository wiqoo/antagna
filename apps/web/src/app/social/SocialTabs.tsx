'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, AtSign, CalendarDays, Megaphone, BarChart3 } from 'lucide-react';

const TABS = [
  { href: '/social', label: 'نظرة عامة', icon: LayoutGrid, exact: true },
  { href: '/social/accounts', label: 'الحسابات', icon: AtSign },
  { href: '/social/calendar', label: 'التقويم والمحتوى', icon: CalendarDays },
  { href: '/social/deals', label: 'صفقات الرعاية', icon: Megaphone },
  { href: '/social/analytics', label: 'التحليلات', icon: BarChart3 },
];

export function SocialTabs() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex flex-wrap gap-1 overflow-x-auto pb-1" aria-label="أقسام السوشيال">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname?.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors ' +
              (active
                ? 'bg-[var(--accent)]/[0.12] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]')
            }
          >
            <Icon size={15} strokeWidth={1.7} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
