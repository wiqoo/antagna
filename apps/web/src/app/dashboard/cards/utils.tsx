/**
 * Pure, server-safe card helpers. Kept out of the client `shell.tsx` so the
 * server-rendered cards can call `toAr`/`cardSpanClass` during prerender.
 */

export type CardSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type AILevel = 'heavy' | 'medium' | 'light' | 'none';

export const CARD_SIZES: CardSize[] = ['sm', 'md', 'lg', 'xl', 'full'];

/** 12-col span per size. Mobile packs compact cards 2-up (col-span-6 of the
 * 12-col grid) so the dashboard isn't an endless single-column scroll; the
 * big list/heatmap cards (lg/xl/full) stay full-width for readability. */
export function cardSpanClass(size: CardSize): string {
  return {
    sm: 'col-span-6 md:col-span-3',
    md: 'col-span-6 md:col-span-4',
    lg: 'col-span-12 md:col-span-6',
    xl: 'col-span-12 md:col-span-8',
    full: 'col-span-12',
  }[size];
}

/** Convert Western digits to Arabic-Indic to match the aesthetic. */
export function toAr(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.charAt(Number(d)));
}

/** Static span wrapper — used by the preview labs (no interactive grid). */
export function Cell({ size = 'md', children }: { size?: CardSize; children: React.ReactNode }) {
  return <div className={cardSpanClass(size)}>{children}</div>;
}
