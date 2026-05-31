/**
 * Post-login landing (also used at root `/`).
 *
 * As of 2026-05-31 the per-position "My Day" surface is merged INTO
 * `/dashboard` — the routine checklist + today's items now render as a section
 * above the position card board. So EVERYONE (admins and positioned users
 * alike) lands on the one unified `/dashboard`. Kept as a function so the root
 * dispatcher + middleware stay stable if landing ever diverges again.
 */
export function roleLanding(_role?: string | null): string {
  return '/dashboard';
}
