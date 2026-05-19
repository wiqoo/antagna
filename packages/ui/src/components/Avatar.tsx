import clsx from 'clsx';

const PALETTE = [
  'bg-emerald-500/20 text-emerald-300',
  'bg-blue-500/20 text-blue-300',
  'bg-purple-500/20 text-purple-300',
  'bg-pink-500/20 text-pink-300',
  'bg-orange-500/20 text-orange-300',
  'bg-cyan-500/20 text-cyan-300',
  'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300',
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
      ? 'h-6 w-6 text-[10px]'
      : size === 'lg'
        ? 'h-10 w-10 text-sm'
        : 'h-8 w-8 text-xs';

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
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
