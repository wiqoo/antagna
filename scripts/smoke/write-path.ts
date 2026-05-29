/**
 * Write-path smoke — create client + project + contact and assert the
 * activity_events ledger grows.
 *
 * Mirrors the real server-action write path (insert a row, then write_activity)
 * without the Next.js layer: it runs SQL through the Supabase Management API
 * (same transport the pillar acceptance smokes use). The point is to prove the
 * core CRM/lifecycle inserts still satisfy their NOT NULL / FK / trigger
 * constraints and that write_activity appends to the ledger.
 *
 * Env: SUPABASE_ACCESS_TOKEN (PAT) + SUPABASE_PROJECT_REF. Exits non-zero on
 * any failed assertion; cleans up everything it created.
 *
 * Run: pnpm tsx scripts/smoke/write-path.ts
 */

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

type CheckResult = { name: string; pass: boolean; detail?: string };
const results: CheckResult[] = [];
function ok(name: string, detail?: string) {
  results.push({ name, pass: true, detail });
  console.log(`  ✓ ${name}${detail ? '  — ' + detail : ''}`);
}
function fail(name: string, detail: string) {
  results.push({ name, pass: false, detail });
  console.log(`  ✗ ${name}  — ${detail}`);
}

async function pg<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`pg ${r.status}: ${text}`);
  return JSON.parse(text) as T[];
}

async function main() {
  if (!PAT || !REF) {
    // Match the CI guard pattern: no-op cleanly when secrets are absent so the
    // step stays green on forks / PRs that can't see the project credentials.
    console.log('⏭  write-path smoke skipped — SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF not set');
    process.exit(0);
  }

  console.log('── Write-path smoke (client + project + contact → activity_events) ──\n');
  const stamp = Date.now();

  // Baseline activity_events count.
  const [{ before }] = await pg<{ before: number }>(
    `SELECT count(*)::int AS before FROM activity_events`,
  );

  let clientId: string | undefined;
  let projectId: string | undefined;
  let contactId: string | undefined;

  try {
    // ── #1 client insert (code + name_ar are the NOT NULL columns) ──────────
    const cli = (
      await pg<{ id: string; code: string }>(
        `INSERT INTO clients (code, name_ar, client_type)
           VALUES ('WP-${stamp}', 'عميل اختبار ${stamp}', 'brand')
           RETURNING id, code`,
      )
    )[0];
    clientId = cli.id;
    ok('#1 client created', `code=${cli.code}`);
    await pg(
      `SELECT write_activity('client', '${cli.id}'::uuid, 'created', 'إنشاء عميل اختبار')`,
    );

    // ── #2 project insert (title + project_type + client_id) ────────────────
    const proj = (
      await pg<{ id: string; code: string }>(
        `INSERT INTO projects (title, project_type, client_id)
           VALUES ('WritePath ${stamp}', 'shoot', '${cli.id}')
           RETURNING id, code`,
      )
    )[0];
    projectId = proj.id;
    ok('#2 project created', `code=${proj.code}`);
    await pg(
      `SELECT write_activity('project', '${proj.id}'::uuid, 'created', 'إنشاء مشروع اختبار', NULL, '${proj.id}'::uuid)`,
    );

    // ── #3 contact insert (client_id FK + full_name) ────────────────────────
    const con = (
      await pg<{ id: string }>(
        `INSERT INTO contacts (client_id, full_name, job_title)
           VALUES ('${cli.id}', 'جهة اتصال ${stamp}', 'Marketing Lead')
           RETURNING id`,
      )
    )[0];
    contactId = con.id;
    ok('#3 contact created', `id=${con.id.slice(0, 8)}…`);
    await pg(
      `SELECT write_activity('contact', '${con.id}'::uuid, 'created', 'إضافة جهة اتصال')`,
    );

    // ── #4 activity_events grew by exactly the 3 we wrote ───────────────────
    const [{ after }] = await pg<{ after: number }>(
      `SELECT count(*)::int AS after FROM activity_events`,
    );
    const delta = after - before;
    if (delta >= 3) ok('#4 activity_events grew', `+${delta} rows (≥3)`);
    else fail('#4 activity_events growth', `expected ≥3, got +${delta}`);

    // ── #5 the project's activity is queryable by project_id ────────────────
    const [{ proj_events }] = await pg<{ proj_events: number }>(
      `SELECT count(*)::int AS proj_events FROM activity_events WHERE project_id = '${proj.id}'`,
    );
    if (proj_events >= 1) ok('#5 project activity queryable', `${proj_events} event(s)`);
    else fail('#5 project activity', `expected ≥1, got ${proj_events}`);
  } finally {
    // ── cleanup (children first; contacts cascade off client, activity by entity) ─
    if (projectId)
      await pg(`DELETE FROM activity_events WHERE entity_id = '${projectId}'`).catch(() => {});
    if (contactId)
      await pg(`DELETE FROM activity_events WHERE entity_id = '${contactId}'`).catch(() => {});
    if (clientId)
      await pg(`DELETE FROM activity_events WHERE entity_id = '${clientId}'`).catch(() => {});
    if (projectId) await pg(`DELETE FROM projects WHERE id = '${projectId}'`).catch(() => {});
    if (clientId) await pg(`DELETE FROM clients WHERE id = '${clientId}'`).catch(() => {});
    console.log('\nCleanup complete.');
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${passed} PASS, ${failed} FAIL\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
