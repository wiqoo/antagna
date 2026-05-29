/**
 * Safe form-value parsing (audit fix). Raw form strings were cast directly to
 * ::numeric / ::timestamptz in SQL, so a comma in a budget or a malformed date
 * threw a raw 500. Parse + validate in TS first; pass null when invalid.
 */

/** Parse a money/number field. Strips commas/spaces. Returns null if empty/invalid. */
export function parseNum(raw: FormDataEntryValue | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/[,\s]/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Parse a date/datetime field. Returns an ISO string if valid, else null. */
export function parseDate(raw: FormDataEntryValue | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  // Accept YYYY-MM-DD or full ISO / datetime-local.
  if (!/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Trim a required string; returns null if empty. */
export function parseStr(raw: FormDataEntryValue | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}
