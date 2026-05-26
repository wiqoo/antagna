'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { setLocale } from '@/lib/locale-actions';

/** Topbar toggle between Arabic (فصحى) and professional English. */
export function LocaleSwitch() {
  const locale = useLocale();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => setLocale(locale === 'ar' ? 'en' : 'ar'))}
      disabled={pending}
      title="Language · اللغة"
      aria-label="Switch language"
      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text)] disabled:opacity-50"
    >
      {locale === 'ar' ? 'EN' : 'ع'}
    </button>
  );
}
