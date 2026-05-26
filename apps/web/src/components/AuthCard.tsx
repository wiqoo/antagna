import type { ReactNode } from 'react';

/**
 * Shared chrome for the pre-auth pages (login, register, forgot, reset) so they
 * share one DNA: dark #0F0F12, single orange #FF6B1A, hairline borders. Pre-auth
 * copy is Arabic-primary with an inline English line (locale cookie may not be
 * set yet, so we don't depend on next-intl here).
 */
export const authField =
  'w-full rounded-lg border border-white/[0.1] bg-[#17171C] px-3 py-2.5 text-[14px] text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-[#FF6B1A]/60';
export const authButton =
  'w-full rounded-lg bg-[#FF6B1A] px-3 py-2.5 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#0F0F12] p-6 text-white"
    >
      <div className="w-full max-w-sm space-y-7">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#FF6B1A] to-[#FF8A3D] text-[15px] font-bold text-black">
            A
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Antagna</span>
        </div>
        <header className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-[13px] leading-relaxed text-white/50">{subtitle}</p>
          )}
        </header>
        {children}
        {footer && (
          <div className="text-center text-[13px] text-white/50">{footer}</div>
        )}
      </div>
    </main>
  );
}
