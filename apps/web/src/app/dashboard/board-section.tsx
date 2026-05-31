import { Suspense } from 'react';
import { buildDashboardBoard } from './board';
import { DashboardGrid } from './dashboard-grid';
import { loadCachedBriefing } from './briefing-actions';
import { BriefingCard } from './briefing-card';

/**
 * Streamed dashboard content.
 *
 * The card board fans out ~10 DB queries; on a cold serverless function that
 * connection storm used to blow past the Vercel runtime timeout, so the WHOLE
 * page never returned ("بيطول وميفتحش"). By rendering the board inside a
 * <Suspense> boundary, the page shell (nav + header) flushes immediately and
 * the board streams in afterwards behind a skeleton — the page always "opens"
 * fast, even when the DB is cold. Shared by /dashboard and /my-day.
 */

function CardSkeleton() {
  return (
    <div className="h-40 animate-pulse rounded-xl border border-[var(--line)] bg-[var(--surface)]/40" />
  );
}

export function BoardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

async function BoardInner({
  profileId,
  role,
  canFinance,
}: {
  profileId: string | null;
  role: string | null | undefined;
  canFinance: boolean;
}) {
  const board = await buildDashboardBoard({ profileId, role, canFinance });
  return (
    <DashboardGrid
      items={board.items}
      initialLayout={board.layout}
      catalogCount={board.catalogCount}
    />
  );
}

/** Just the card grid, streamed. Used by /my-day (which has its own header). */
export function StreamedBoard({
  profileId,
  role,
  canFinance = false,
  skeletonCount = 6,
}: {
  profileId: string | null;
  role: string | null | undefined;
  canFinance?: boolean;
  skeletonCount?: number;
}) {
  return (
    <Suspense fallback={<BoardSkeleton count={skeletonCount} />}>
      <BoardInner profileId={profileId} role={role} canFinance={canFinance} />
    </Suspense>
  );
}

function HeroSkeleton() {
  return (
    <div className="h-44 animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)]/40" />
  );
}

async function BriefingInner({
  greeting,
  dateStr,
  firstName,
}: {
  greeting: string;
  dateStr: string;
  firstName: string;
}) {
  const initialBriefing = await loadCachedBriefing().catch(() => null);
  return (
    <BriefingCard
      initial={initialBriefing}
      greeting={greeting}
      dateStr={dateStr}
      firstName={firstName}
    />
  );
}

/** AI briefing hero, streamed on its OWN Suspense lane so the (light) cache read
 *  never waits on the heavy My-Day queries or the card board — and vice-versa.
 *  Used by /dashboard. */
export function StreamedBriefing(props: {
  greeting: string;
  dateStr: string;
  firstName: string;
}) {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <BriefingInner {...props} />
    </Suspense>
  );
}
