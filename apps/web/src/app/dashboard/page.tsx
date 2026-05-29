import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/view-as';
import { BriefingCard } from './briefing-card';
import { loadCachedBriefing } from './briefing-actions';
import { DashboardGrid } from './dashboard-grid';
import { buildDashboardBoard } from './board';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard');

  // Honor View-As impersonation — the greeting / topbar / any per-user
  // data should match the profile the admin is viewing as.
  const current = await getCurrentProfile();

  // First-login flow (Pillar 16 §H.4). Only redirect the REAL user (not
  // when an admin is viewing-as someone else, otherwise they get bounced
  // every time they pick a fake profile that hasn't onboarded).
  if (current && !current.isImpersonating) {
    const [self] = await db.execute<{ status: string }>(
      sql`SELECT onboarding_state->>'status' AS status FROM profiles WHERE id = ${current.id}::uuid`,
    );
    const status = (self as unknown as { status: string }[])[0]?.status;
    if (status === 'pending' || status === 'in_progress') {
      redirect('/welcome');
    }
  }

  const greetingName =
    current?.displayName?.trim().split(/\s+/)[0] ??
    user.email?.split('@')[0] ??
    'صديقي';

  // The card board (queries + row→card mapping + per-position layout) is shared
  // with /my-day via buildDashboardBoard — import, don't rebuild.
  const [initialBriefing, board] = await Promise.all([
    loadCachedBriefing().catch(() => null),
    buildDashboardBoard({ profileId: current?.id ?? null, role: current?.role }),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مرحباً' : 'مساء الخير';
  const dateStr = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <Shell
      user={{
        email: current?.email ?? user.email ?? '',
        displayName: current?.displayName ?? user.email?.split('@')[0],
      }}
      activePath="/dashboard"
    >
      {/* AI Daily Briefing — hero */}
      <BriefingCard
        initial={initialBriefing}
        greeting={greeting}
        dateStr={dateStr}
        firstName={greetingName}
      />

      {/* V5 bento — customizable card grid (size / reorder / show-hide) */}
      <DashboardGrid items={board.items} initialLayout={board.layout} catalogCount={board.catalogCount} />

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-4 text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
        <span>— Antagna Dashboard</span>
        <span>{new Date().getFullYear()} · Volt Production</span>
      </div>
    </Shell>
  );
}
