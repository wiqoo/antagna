/**
 * Effective-profile scope for the Sprint 0 masking layer (D-037/D-039, Phase C).
 *
 * The app connects as the service-role DB role, so the `v_*_safe` views can't
 * read a per-user Postgres identity — they call `current_effective_profile_id()`,
 * which reads the transaction-local GUC `app.current_profile_id`. This helper
 * sets that GUC and runs the read in the SAME transaction.
 *
 * WHY a transaction (load-bearing): DATABASE_URL is the Supabase transaction
 * pooler (port 6543, `prepare:false`). Each bare `db.execute()` borrows a fresh
 * pooled backend, so a GUC set in one call would NOT survive to a separate
 * SELECT (and could leak to another request). A `db.transaction()` pins one
 * backend for its lifetime even under pgBouncer transaction mode, so the
 * txn-local `set_config(..., true)` reaches the view's CASE WHEN masks.
 *
 * Usage:
 *   const rows = await withProfileScope(effectivePid, (tx) =>
 *     tx.select().from(vProjectsSafe));
 *
 * Never set the GUC with a bare db.execute on the shared pool, and never use
 * set_config(..., false) (session-scoped) — it would leak identity across
 * requests.
 */
import { sql } from 'drizzle-orm';
import { db, type DB } from './client';

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export async function withProfileScope<T>(
  profileId: string | null,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // Empty string (not null) so current_setting(...,true)::uuid in the view
    // resolves cleanly to NULL when signed out → masks fail-closed.
    await tx.execute(sql`SELECT set_config('app.current_profile_id', ${profileId ?? ''}, true)`);
    return fn(tx);
  });
}

/**
 * Write-side actor scope (audit fix). Mutating server actions set the audit
 * principal `app.acting_as` and then run the mutation / SECURITY DEFINER
 * function (e.g. fn_checkout_equipment via current_user_has_permission). The
 * GUC is transaction-local, and DATABASE_URL is the 6543 transaction pooler —
 * so the set_config and the mutation MUST run on the SAME pinned connection,
 * i.e. inside one db.transaction. The previous pattern (two separate bare
 * db.execute calls) set the GUC on one pooled connection and ran the mutation
 * on another, so the actor never reached the trigger/function (audit actor +
 * permission checks resolved NULL).
 *
 * Usage:
 *   await withActor(actorProfileId, (tx) =>
 *     tx.execute(sql`SELECT fn_checkout_equipment(${reservationId}::uuid)`));
 */
export async function withActor<T>(
  actorProfileId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.acting_as', ${actorProfileId}, true)`);
    return fn(tx);
  });
}
