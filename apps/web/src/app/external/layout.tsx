import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';

// Standalone module chrome (no Antagna app shell). Gated by login: any
// authenticated Antagna user reaches it in phase 1; independent partner
// accounts arrive in phase 2.
export default async function ExternalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/external');

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--bg)]/90 px-5 py-2.5 backdrop-blur">
        <Link href="/external" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-[14px] font-bold text-[#1a1a1a]">V</span>
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold">الشغل الخارجي</span>
            <span className="block text-[10px] text-[var(--text-dim)]">Volt Production</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 text-[12.5px]">
          <Link href="/external" className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]">الشغلات</Link>
          <Link href="/external/partners" className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]">الشركاء</Link>
          <Link href="/external/new" className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium text-[#1a1a1a] hover:bg-[var(--accent-hover)]">+ شغلة جديدة</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-7">{children}</main>
    </div>
  );
}
