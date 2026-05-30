/**
 * Pure, server-safe card helpers. Kept out of the client `shell.tsx` so the
 * server-rendered cards can call `toAr`/`cardSpanClass` during prerender.
 */

export type CardSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type AILevel = 'heavy' | 'medium' | 'light' | 'none';

export const CARD_SIZES: CardSize[] = ['sm', 'md', 'lg', 'xl', 'full'];

/** Responsive span per size, matched to the grid's breakpoints
 * (grid-cols-1 → sm:grid-cols-2 → md:grid-cols-12):
 *  - phone (1 col): every card is full-width and readable (was half-width ~165px)
 *  - sm (2 cols): compact cards 2-up, big cards full-width
 *  - md+ (12 cols): the original 3/4/6/8/12 layout. */
export function cardSpanClass(size: CardSize): string {
  return {
    sm: 'col-span-1 sm:col-span-1 md:col-span-3',
    md: 'col-span-1 sm:col-span-1 md:col-span-4',
    lg: 'col-span-1 sm:col-span-2 md:col-span-6',
    xl: 'col-span-1 sm:col-span-2 md:col-span-8',
    full: 'col-span-1 sm:col-span-2 md:col-span-12',
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
