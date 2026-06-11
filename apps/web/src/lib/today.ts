/**
 * Date anchoring for AI prompts.
 *
 * LLMs have no clock — given "deliver by Feb 2" with no reference point a model
 * will happily call a long-past deadline "today / very soon" and flag it urgent.
 * Every time-sensitive prompt (urgency, deadlines, "next step", missing-info)
 * must be told the current date so it can tell PAST from UPCOMING.
 *
 * Volt operates in Asia/Riyadh, so that's the reference timezone.
 */

/** Today's date in Asia/Riyadh as `YYYY-MM-DD` (lexicographically comparable). */
export function riyadhToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * A one-line anchor to prepend to any time-sensitive AI prompt. Tells the model
 * today's date and the hard rule that earlier dates are history, not upcoming.
 */
export function promptDateAnchor(): string {
  const today = riyadhToday();
  return `Today's date is ${today} (Asia/Riyadh). Any date BEFORE ${today} has ALREADY PASSED — treat it as history, never as "today", "soon", or "upcoming", and never mark it urgent.`;
}

/**
 * True when an ISO date (`YYYY-MM-DD` or a full timestamp) is strictly before
 * today in Riyadh. Use as a DETERMINISTIC guard — never trust the model for
 * date math. Returns false for null/empty/unparseable input (fail-open).
 */
export function isPastDeadline(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day < riyadhToday();
}
