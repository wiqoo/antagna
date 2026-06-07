'use client';

import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { KeyRound, DollarSign, Mail, BrainCircuit, SlidersHorizontal, CreditCard, MessageCircle } from 'lucide-react';

export type TabId = 'keys' | 'cost' | 'email' | 'whatsapp' | 'brain' | 'settings' | 'subs';

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'keys', label: 'المفاتيح والتوكنات', icon: <KeyRound size={14} /> },
  { id: 'cost', label: 'حارس تكلفة الـ AI', icon: <DollarSign size={14} /> },
  { id: 'email', label: 'تكامل البريد', icon: <Mail size={14} /> },
  { id: 'whatsapp', label: 'واتساب', icon: <MessageCircle size={14} /> },
  { id: 'brain', label: 'الذاكرة (Brain)', icon: <BrainCircuit size={14} /> },
  { id: 'settings', label: 'إعدادات النظام', icon: <SlidersHorizontal size={14} /> },
  { id: 'subs', label: 'الاشتراكات و Cron', icon: <CreditCard size={14} /> },
];

export function SystemConsole({ tab, children }: { tab: TabId; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const go = (id: TabId) => {
    router.push(`${pathname}?tab=${id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            className={
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ' +
              (tab === t.id
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text)]')
            }
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
