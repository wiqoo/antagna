/**
 * Locale-aware formatting — the layer the runtime TranslateLayer can't do.
 *
 * The DOM translate layer swaps words; it can't reliably turn `ر.س` into `SAR`
 * or an Arabic date into `en-GB`, and it can't fix the UTC display bug. This
 * module is the single source of truth for dates / times / currency / numbers,
 * always rendered in Asia/Riyadh and in the active locale's conventions.
 *
 *   EN: 09/06/2026 · 14:30 · SAR 12,500 · 3d ago
 *   AR: 09/06/2026 · 14:30 · 12,500 ر.س · منذ 3 يوم   (Latin digits, matching
 *       what the translate layer normalizes Arabic-Indic digits to anyway)
 *
 * Server components: `const f = await getFormat()`.
 * Client components: `const f = useFormat()`.
 */
import { useLocale } from 'next-intl';
import { getLocale } from 'next-intl/server';

const TZ = 'Asia/Riyadh';
export type Loc = 'ar' | 'en';

type DateInput = Date | string | number | null | undefined;
function toDate(d: DateInput): Date | null {
  if (d === null || d === undefined || d === '') return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export type Formatter = {
  /** 09/06/2026 */
  date(d: DateInput): string;
  /** 14:30 (24h, Riyadh) */
  time(d: DateInput): string;
  /** 09/06/2026 · 14:30 */
  dateTime(d: DateInput): string;
  /** 9 Jun 2026 / ٩ يونيو ٢٠٢٦ — long, for headers */
  dateLong(d: DateInput): string;
  /** compact: now/الآن · 5m/5د · 3h/3س · 2d/منذ 2 يوم · then falls back to date() */
  relative(d: DateInput): string;
  /** EN "SAR 12,500" · AR "12,500 ر.س"; pass decimals to keep them */
  currency(n: number | null | undefined, opts?: { decimals?: number; currency?: string }): string;
  /** grouped number in Latin digits (12,500) */
  number(n: number | null | undefined): string;
};

export function makeFormat(locale: string): Formatter {
  const l: Loc = locale === 'en' ? 'en' : 'ar';
  // Arabic with Latin numerals + Riyadh tz keeps digits consistent with the
  // translate layer (which Latinizes Arabic-Indic digits) and fixes UTC slicing.
  const intlLoc = l === 'en' ? 'en-GB' : 'ar-SA-u-nu-latn';

  const dDMY = new Intl.DateTimeFormat(intlLoc, { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
  const dLong = new Intl.DateTimeFormat(intlLoc, { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
  const tHM = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

  const num = (n: number) => n.toLocaleString('en-US');

  return {
    date: (d) => {
      const dt = toDate(d);
      return dt ? dDMY.format(dt) : '—';
    },
    time: (d) => {
      const dt = toDate(d);
      return dt ? tHM.format(dt) : '—';
    },
    dateTime: (d) => {
      const dt = toDate(d);
      return dt ? `${dDMY.format(dt)} · ${tHM.format(dt)}` : '—';
    },
    dateLong: (d) => {
      const dt = toDate(d);
      return dt ? dLong.format(dt) : '—';
    },
    relative: (d) => {
      const dt = toDate(d);
      if (!dt) return '—';
      const sec = Math.round((Date.now() - dt.getTime()) / 1000);
      const abs = Math.abs(sec);
      if (abs < 45) return l === 'en' ? 'now' : 'الآن';
      const mins = Math.round(abs / 60);
      const hrs = Math.round(abs / 3600);
      const days = Math.round(abs / 86400);
      if (abs < 3600) return l === 'en' ? `${mins}m` : `${mins} د`;
      if (abs < 86400) return l === 'en' ? `${hrs}h` : `${hrs} س`;
      if (days < 30) return l === 'en' ? `${days}d` : `${days} يوم`;
      // older than a month → just show the date
      return dDMY.format(dt);
    },
    currency: (n, opts) => {
      if (n === null || n === undefined || Number.isNaN(n)) return '—';
      const decimals = opts?.decimals ?? 0;
      const ccy = opts?.currency ?? 'SAR';
      const v = n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      if (ccy === 'SAR') return l === 'en' ? `SAR ${v}` : `${v} ر.س`;
      return l === 'en' ? `${ccy} ${v}` : `${v} ${ccy}`;
    },
    number: (n) => (n === null || n === undefined || Number.isNaN(n) ? '—' : num(n)),
  };
}

/** Client-component formatter (reads the next-intl locale). */
export function useFormat(): Formatter {
  return makeFormat(useLocale());
}

/** Server-component / server-action formatter. */
export async function getFormat(): Promise<Formatter> {
  return makeFormat(await getLocale());
}
