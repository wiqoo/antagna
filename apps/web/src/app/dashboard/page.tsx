import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { ListChecks } from 'lucide-react';
import { db } from '@antagna/db';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/view-as';
import { can } from '@/lib/authz';
import { financialsHidden } from '@/lib/financials';
import { StreamedBriefing, StreamedBoard } from './board-section';
import { StreamedMyDay } from './my-day-section';
import { BoardRefreshButton } from './board-refresh-button';

export const dynamic = 'force-dynamic';
// The streamed board has ~10 DB queries; give the function headroom so a cold
// start can't get SIGKILL'd at the default before the stream finishes.
export const maxDuration = 30;

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard');

  // Honor View-As impersonation. Resilient: a cold-start DB hiccup here must NOT
  // crash the home page — degrade to no-profile rather than the error boundary.
  const current = await getCurrentProfile().catch((e) => {
    console.error('[dashboard] getCurrentProfile failed', e);
    return null;
  });

  // First-login flow (Pillar 16 §H.4). Only redirect the REAL user. The query is
  // wrapped so a cold-start connection drop skips the gate instead of crashing;
  // the redirect() itself stays OUTSIDE the try (it throws NEXT_REDIRECT which
  // must propagate, not be swallowed).
  let onboardingStatus: string | undefined;
  if (current && !current.isImpersonating) {
    try {
      const [self] = await db.execute<{ status: string }>(
        sql`SELECT onboarding_state->>'status' AS status FROM profiles WHERE id = ${current.id}::uuid`,
      );
      onboardingStatus = (self as unknown as { status: string }[])[0]?.status;
    } catch (e) {
      console.error('[dashboard] onboarding check failed', e);
    }
  }
  if (onboardingStatus === 'pending' || onboardingStatus === 'in_progress') {
    redirect('/welcome');
  }

  const greetingName =
    current?.displayName?.trim().split(/\s+/)[0] ??
    user.email?.split('@')[0] ??
    'صديقي';

  // Finance hidden for phase-1 → no canFinance query at all (one fewer cold-start
  // query). When re-enabled, the can() check is .catch-guarded so it can't crash.
  const canFinance = financialsHidden()
    ? false
    : await can('financials.read').catch(() => false);

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
      {/* Three independent streamed lanes — the shell flushes instantly and each
          section streams in on its own when ready (a slow board never blocks the
          briefing or the personal "my day" items, and vice-versa):
          1) AI briefing hero  2) my routine + today's items  3) position board. */}
      <StreamedBriefing greeting={greeting} dateStr={dateStr} firstName={greetingName} />

      {current?.id && (
        <StreamedMyDay
          profileId={current.id}
          isImpersonating={!!current.isImpersonating}
        />
      )}

      <div className="flex items-center justify-between pt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
        <span className="flex items-center gap-2">
          <ListChecks size={13} />
          <span>لوحة منصبك</span>
        </span>
        <BoardRefreshButton />
      </div>
      <StreamedBoard
        profileId={current?.id ?? null}
        role={current?.role}
        canFinance={canFinance}
      />

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-4 text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
        <span>— Antagna Dashboard</span>
        <span>{new Date().getFullYear()} · Volt Production</span>
      </div>
    </Shell>
  );
}
