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
}: {
  profileId: string | null;
  role: string | null | undefined;
}) {
  const board = await buildDashboardBoard({ profileId, role });
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
  skeletonCount = 6,
}: {
  profileId: string | null;
  role: string | null | undefined;
  skeletonCount?: number;
}) {
  return (
    <Suspense fallback={<BoardSkeleton count={skeletonCount} />}>
      <BoardInner profileId={profileId} role={role} />
    </Suspense>
  );
}

async function DashboardInner({
  profileId,
  role,
  greeting,
  dateStr,
  firstName,
}: {
  profileId: string | null;
  role: string | null | undefined;
  greeting: string;
  dateStr: string;
  firstName: string;
}) {
  // Briefing is a light cache read; the board is the heavy part. Run together,
  // both behind the same Suspense boundary so the shell never waits on them.
  const [initialBriefing, board] = await Promise.all([
    loadCachedBriefing().catch(() => null),
    buildDashboardBoard({ profileId, role }),
  ]);
  return (
    <>
      <BriefingCard
        initial={initialBriefing}
        greeting={greeting}
        dateStr={dateStr}
        firstName={firstName}
      />
      <DashboardGrid
        items={board.items}
        initialLayout={board.layout}
        catalogCount={board.catalogCount}
      />
    </>
  );
}

/** Briefing hero + card grid, streamed. Used by /dashboard. */
export function StreamedDashboard(props: {
  profileId: string | null;
  role: string | null | undefined;
  greeting: string;
  dateStr: string;
  firstName: string;
}) {
  return (
    <Suspense
      fallback={
        <>
          <div className="h-44 animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)]/40" />
          <BoardSkeleton />
        </>
      }
    >
      <DashboardInner {...props} />
    </Suspense>
  );
}
