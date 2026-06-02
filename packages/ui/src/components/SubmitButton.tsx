'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** Optional label shown while submitting (defaults to the children). */
  pendingText?: ReactNode;
};

/**
 * A submit button that shows a spinner + disables itself while its parent
 * `<form action={…}>` is submitting (via `useFormStatus`). Drop-in replacement
 * for `<button type="submit">` inside server-action forms — gives instant
 * "working…" feedback so the user knows their submit registered.
 */
export function SubmitButton({ children, className, pendingText, disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={clsx('inline-flex items-center justify-center gap-2', className)}
      {...rest}
    >
      {pending && <Loader2 size={15} className="animate-spin" />}
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}
