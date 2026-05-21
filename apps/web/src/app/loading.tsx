import { SkeletonRows, SkeletonStats } from '@antagna/ui';

/**
 * Global default loading screen. Individual routes can override by adding
 * their own loading.tsx — but the rough "header + stats + rows" shape fits
 * 80% of pages.
 */
export default function GlobalLoading() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 md:px-8">
      <div className="space-y-3">
        <div
          className="antagna-skeleton h-3 w-28"
          style={{
            backgroundColor: 'var(--surface-2)',
            backgroundImage:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
            backgroundSize: '200% 100%',
            borderRadius: 4,
          }}
        />
        <div
          className="antagna-skeleton h-7 w-72"
          style={{
            backgroundColor: 'var(--surface-2)',
            backgroundImage:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
            backgroundSize: '200% 100%',
            borderRadius: 6,
          }}
        />
      </div>
      <SkeletonStats tiles={4} />
      <SkeletonRows rows={6} />
    </div>
  );
}
