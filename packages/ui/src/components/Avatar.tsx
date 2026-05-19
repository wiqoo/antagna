import clsx from 'clsx';

const PALETTE = [
  'bg-emerald-500/15 text-emerald-300/90 ring-emerald-500/20',
  'bg-blue-500/15 text-blue-300/90 ring-blue-500/20',
  'bg-purple-500/15 text-purple-300/90 ring-purple-500/20',
  'bg-pink-500/15 text-pink-300/90 ring-pink-500/20',
  'bg-orange-500/15 text-orange-300/90 ring-orange-500/20',
  'bg-cyan-500/15 text-cyan-300/90 ring-cyan-500/20',
  'bg-amber-500/15 text-amber-300/90 ring-amber-500/20',
  'bg-rose-500/15 text-rose-300/90 ring-rose-500/20',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const safe = (name ?? '?').trim();
  const initials =
    safe
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0))
      .join('')
      .toUpperCase() || '?';
  const color = PALETTE[hashString(safe) % PALETTE.length];
  const sizeCls =
    size === 'sm'
      ? 'h-6 w-6 text-[9px]'
      : size === 'lg'
        ? 'h-10 w-10 text-[12px]'
        : 'h-8 w-8 text-[10px]';

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset',
        sizeCls,
        color,
        className,
      )}
      title={safe}
    >
      {initials}
    </span>
  );
}
