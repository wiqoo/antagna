/**
 * Financial visibility — single switch for the phase-1 launch.
 *
 * Mohammed's decision: hide ALL financial figures (revenue / cost / salaries /
 * SAR / margins / payment terms) from the whole system for now, re-enableable
 * later. Driven by NEXT_PUBLIC_FINANCIALS_HIDDEN so the SAME flag works in
 * server gates AND client components (MoneyDisplay, nav). NEXT_PUBLIC is inlined
 * at build → set it on Vercel and redeploy to flip.
 *
 * To RE-ENABLE finance later: set NEXT_PUBLIC_FINANCIALS_HIDDEN=false (or remove
 * it) and redeploy — `financialsVisible()` then falls back to the existing
 * per-permission gate (financials.read / projects.read.financial).
 */
import { canAny } from './authz';

/** True when financials are globally hidden (env flag). Sync; client+server. */
export function financialsHidden(): boolean {
  return process.env.NEXT_PUBLIC_FINANCIALS_HIDDEN === 'true';
}

/** Whether the current viewer may see financial figures. Hidden → false for
 *  everyone; otherwise the normal per-permission gate. */
export async function financialsVisible(): Promise<boolean> {
  if (financialsHidden()) return false;
  return canAny(['financials.read', 'projects.read.financial']);
}
