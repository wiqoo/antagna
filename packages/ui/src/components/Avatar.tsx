import clsx from 'clsx';

const PALETTE = [
  'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'bg-blue-100 text-blue-700 ring-blue-200',
  'bg-purple-100 text-purple-700 ring-purple-200',
  'bg-pink-100 text-pink-700 ring-pink-200',
  'bg-orange-100 text-orange-700 ring-orange-200',
  'bg-cyan-100 text-cyan-700 ring-cyan-200',
  'bg-amber-100 text-amber-700 ring-amber-200',
  'bg-rose-100 text-rose-700 ring-rose-200',
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
        : 'h-7 w-7 text-[10px]';

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
