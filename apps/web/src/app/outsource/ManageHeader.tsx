import Link from 'next/link';
import { logout } from './session-actions';

// Volt-management chrome (top nav). Rendered by the gated management pages.
export function ManageHeader({ name }: { name?: string | null }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--bg)]/90 px-5 py-2.5 backdrop-blur">
      <Link href="/outsource" className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-[14px] font-bold text-[#1a1a1a]">V</span>
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold">المشاريع الخارجية</span>
          <span className="block text-[10px] text-[var(--text-dim)]">Volt Production</span>
        </span>
      </Link>
      <nav className="flex items-center gap-1.5 text-[12.5px]">
        <Link href="/outsource" className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]">المشاريع</Link>
        <Link href="/outsource/partners" className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]">الشركاء</Link>
        <Link href="/outsource/new" className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium text-[#1a1a1a] hover:bg-[var(--accent-hover)]">+ مشروع جديد</Link>
        {name && <span className="ms-1 hidden text-[11px] text-[var(--text-dim)] sm:inline">· {name}</span>}
        <form action={logout}><button className="rounded-lg px-2.5 py-1.5 text-[var(--text-dim)] hover:text-[var(--text)]">خروج</button></form>
      </nav>
    </header>
  );
}
