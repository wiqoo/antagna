import Link from 'next/link';
import { logout } from './session-actions';

// Partner-portal chrome.
export function PortalHeader({ name }: { name?: string | null }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--bg)]/90 px-5 py-2.5 backdrop-blur">
      <Link href="/external/portal" className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-[14px] font-bold text-[#1a1a1a]">V</span>
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold">شغلك مع Volt</span>
          <span className="block text-[10px] text-[var(--text-dim)]">{name ?? 'الشريك'}</span>
        </span>
      </Link>
      <form action={logout}><button className="rounded-lg px-2.5 py-1.5 text-[12.5px] text-[var(--text-dim)] hover:text-[var(--text)]">خروج</button></form>
    </header>
  );
}
