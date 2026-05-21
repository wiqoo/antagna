/**
 * Loading skeletons — three variants for the three places a page actually
 * needs them: list rows, stat tiles, and a generic card body. Animated via
 * pure CSS gradient (no JS) so it runs even in low-power conditions.
 *
 * Usage: render alongside Suspense / loading.tsx / explicit loading state.
 */

export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={'antagna-skeleton ' + className}
      style={{
        backgroundColor: 'var(--surface-2)',
        backgroundImage:
          'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
        backgroundSize: '200% 100%',
        animation: 'antagna-skeleton 1.4s linear infinite',
        borderRadius: 6,
        ...style,
      }}
    />
  );
}

export function SkeletonRows({
  rows = 5,
  height = 56,
}: {
  rows?: number;
  height?: number;
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} style={{ height }} />
      ))}
    </div>
  );
}

export function SkeletonStats({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: tiles }).map((_, i) => (
        <Skeleton key={i} style={{ height: 88 }} />
      ))}
    </div>
  );
}
