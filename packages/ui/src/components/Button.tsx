import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-[--accent] text-black hover:bg-[--accent-hover] shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_8px_16px_-8px_rgba(245,214,10,0.4)]',
  secondary:
    'bg-[--surface] text-[--text] border border-[--line] hover:bg-[--surface-hover] hover:border-[--line-strong]',
  ghost: 'text-[--text-muted] hover:bg-[--surface]/80 hover:text-[--text]',
  danger: 'bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20',
};

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
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
        'inline-flex items-center justify-center rounded-xl font-medium',
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
