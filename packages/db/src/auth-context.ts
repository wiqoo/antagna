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
