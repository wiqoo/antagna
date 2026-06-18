import type { Metadata } from 'next';
import { requireOwner } from './auth';
import { BottomNav } from './BottomNav';
import { CaptureFab } from './CaptureFab';

export const metadata: Metadata = {
  title: 'مساحتي',
  manifest: '/me/manifest.webmanifest',
};

// Personal system — mobile-first standalone surface (no Antagna shell).
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="relative mx-auto min-h-[100dvh] max-w-md bg-[var(--bg)] pb-28 text-[var(--text)]">
      <main className="px-4 py-4">{children}</main>
      <CaptureFab />
      <BottomNav />
    </div>
  );
}
