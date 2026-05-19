import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-[--accent] text-black hover:bg-[--accent-hover] font-semibold',
  secondary:
    'border border-[--line] bg-[--bg-elevated] text-[--text] hover:border-[--line-strong] hover:bg-[--surface]',
  ghost: 'text-[--text-muted] hover:bg-[--surface]/60 hover:text-[--text]',
  danger:
    'border border-[--danger]/30 bg-[--danger]/10 text-[--danger] hover:bg-[--danger]/20',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[12px] gap-1.5',
  md: 'h-10 px-4 text-[13px] gap-2',
  lg: 'h-12 px-5 text-[14px] gap-2',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      className={clsx(
        'magnet inline-flex items-center justify-center rounded-md',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'active:scale-[0.98]',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
