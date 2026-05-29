/**
 * App-layer granular authorization.
 *
 * The app's Drizzle/Supabase access runs as the service-role key, which
 * BYPASSES Postgres RLS — so RLS policies do NOT gate feature pages/actions.
 * This module is the real app-layer gate. It resolves the **effective** profile
 * (view-as aware, via getCurrentProfile) and asks the existing DB functions
 * `has_permission(profile_id, key)` / `has_capability(profile_id, key)` — the
 * single source of truth for resolution. As of Sprint 0 (D-037/D-041) that is:
 * per-user override → position default across all effective positions (primary
 * `position_key` + multi-hat `user_position_overrides`) → `'*'` wildcard
 * (general_manager only). The old `role='system_admin'` blanket bypass was
 * REMOVED, so a system_admin / production_director stays bound by field-level
 * restrictions (spec Test 10). We do NOT re-implement that logic in TS.
 *
 * Field-level masking is NOT done here — it lives in the `v_*_safe` views,
 * which read the `app.current_profile_id` GUC set by `withProfileScope()`
 * (@antagna/db). `can()` gates ACTIONS; the views mask COLUMNS.
 *
 * Usage:
 *   - Server Components (page guards):  await requirePermission('equipment.write')
 *   - Server Actions:                   await requirePermissionAction('crm.client.create')
 *   - Conditional UI:                   const ok = await can('suggestions.approve')
 */
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getCurrentProfile } from './view-as';

export class ForbiddenError extends Error {
  constructor(key: string) {
    super(`forbidden: missing permission "${key}"`);
    this.name = 'ForbiddenError';
  }
}

/** The effective (view-as aware) profile id, or null when signed out. */
export async function getEffectiveProfileId(): Promise<string | null> {
  const current = await getCurrentProfile();
  return current?.id ?? null;
}

async function permits(profileId: string, key: string): Promise<boolean> {
  const rows = (await db.execute<{ ok: boolean }>(
    sql`SELECT has_permission(${profileId}::uuid, ${key}) AS ok`,
  )) as unknown as { ok: boolean }[];
  return rows[0]?.ok === true;
}

/** Does the current user have `key`? false when signed out. */
export async function can(key: string): Promise<boolean> {
  const pid = await getEffectiveProfileId();
  if (!pid) return false;
  return permits(pid, key);
}

/** Resolve several permission keys in ONE round-trip → { key: boolean }. */
export async function canMany(keys: string[]): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = Object.fromEntries(keys.map((k) => [k, false]));
  const pid = await getEffectiveProfileId();
  if (!pid || keys.length === 0) return out;
  const rows = (await db.execute<{ key: string; ok: boolean }>(
    sql`SELECT k AS key, has_permission(${pid}::uuid, k) AS ok
        FROM unnest(${keys}::text[]) AS k`,
  )) as unknown as { key: string; ok: boolean }[];
  for (const r of rows) out[r.key] = r.ok === true;
  return out;
}

export async function canAll(keys: string[]): Promise<boolean> {
  const map = await canMany(keys);
  return keys.every((k) => map[k]);
}

export async function canAny(keys: string[]): Promise<boolean> {
  const map = await canMany(keys);
  return keys.some((k) => map[k]);
}

/** Does the current user have capability `key`? */
export async function hasCapability(key: string): Promise<boolean> {
  const pid = await getEffectiveProfileId();
  if (!pid) return false;
  const rows = (await db.execute<{ ok: boolean }>(
    sql`SELECT has_capability(${pid}::uuid, ${key}) AS ok`,
  )) as unknown as { ok: boolean }[];
  return rows[0]?.ok === true;
}

/**
 * Page guard (Server Component): signed-out → /login; lacking the permission →
 * /dashboard. Returns the effective profile id for reuse.
 */
export async function requirePermission(key: string): Promise<{ profileId: string }> {
  const pid = await getEffectiveProfileId();
  if (!pid) redirect('/login');
  if (!(await permits(pid, key))) redirect('/dashboard');
  return { profileId: pid };
}

/**
 * Server-action guard: throws (matches the existing `throw 'forbidden'`
 * convention used by view-as-actions). Returns the effective profile id.
 */
export async function requirePermissionAction(key: string): Promise<string> {
  const pid = await getEffectiveProfileId();
  if (!pid || !(await permits(pid, key))) throw new ForbiddenError(key);
  return pid;
}

export async function requireCapability(key: string): Promise<{ profileId: string }> {
  const pid = await getEffectiveProfileId();
  if (!pid) redirect('/login');
  if (!(await hasCapability(key))) redirect('/dashboard');
  return { profileId: pid };
}
