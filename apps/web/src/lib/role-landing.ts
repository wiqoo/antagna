/**
 * Role-aware landing — where each role most wants to start after login (and at
 * root `/`).
 *
 * As of the per-position My Day home (Phase 2): every non-admin lands on
 * `/my-day` — their position's daily routine + today's items + their position
 * card board, all in one place. Admins (system_admin / general_manager) keep
 * the full overview `/dashboard` (they run the whole shop, not one position).
 *
 * `role` here is the legacy `profiles.role`. Admin detection mirrors
 * ADMIN_ROLES in view-as.ts / Shell.tsx.
 */
const ADMIN_ROLES = new Set(['system_admin', 'general_manager']);

export function roleLanding(role: string | null | undefined): string {
  if (role && ADMIN_ROLES.has(role)) return '/dashboard';
  return '/my-day';
}
