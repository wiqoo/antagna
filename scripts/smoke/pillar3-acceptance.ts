/**
 * Pillar 3 §10 acceptance verification.
 *
 * Exercises:
 *   - has_permission resolves role defaults
 *   - per-user override (grant + revoke)
 *   - permission expiry
 *   - acting-for: SET LOCAL app.acting_as → audit_log captures acted_as_id
 *
 * Plus a smoke test of the §6 resolver wrappers via direct PG queries.
 *
 * Run from repo root with .env.local sourced:
 *   set -a && source .env.local && set +a && pnpm tsx scripts/smoke/pillar3-acceptance.ts
 */

const PAT = process.env.SUPABASE_ACCESS_TOKEN!;
const REF = process.env.SUPABASE_PROJECT_REF!;

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
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`pg ${r.status}: ${text}`);
  return JSON.parse(text) as T[];
}

async function main() {
  console.log('── Pillar 3 §10 acceptance ──\n');

  const stamp = Date.now();
  const amEmail = `pillar3-am-${stamp}@antagna.test`;
  const userEmail = `pillar3-user-${stamp}@antagna.test`;
  const proxyEmail = `pillar3-proxy-${stamp}@antagna.test`;

  // Seed 3 test profiles.
  //
  // Sprint 0 (D-037/D-041): the permission graph resolves via `position_key` +
  // user_position_overrides, NOT the legacy `role`. So we seed positions here:
  //   - amEmail    → account_manager  (gets contact.create as a position default)
  //   - userEmail  → trainee          (a real low-privilege position, no contact.create)
  //   - proxyEmail → system_admin     (a position WITHOUT the '*' wildcard — there
  //                                     is no admin bypass anymore; only
  //                                     general_manager carries '*')
  // `role` is set too only because it is still NOT NULL on profiles; it no longer
  // drives has_permission.
  await pg(`
    INSERT INTO profiles (email, display_name, role, position_key) VALUES
      ('${amEmail}',   'AM Probe',    'user', 'account_manager'),
      ('${userEmail}', 'User Probe',  'user', 'trainee'),
      ('${proxyEmail}','Proxy Probe', 'user', 'system_admin')
    ON CONFLICT (email) DO UPDATE SET position_key = EXCLUDED.position_key, role = EXCLUDED.role;
  `);

  const amRow = (await pg<{ id: string }>(
    `SELECT id FROM profiles WHERE email='${amEmail}'`,
  ))[0];
  const userRow = (await pg<{ id: string }>(
    `SELECT id FROM profiles WHERE email='${userEmail}'`,
  ))[0];
  const proxyRow = (await pg<{ id: string }>(
    `SELECT id FROM profiles WHERE email='${proxyEmail}'`,
  ))[0];
  if (!amRow?.id || !userRow?.id || !proxyRow?.id) {
    fail('seed profiles', 'one of the probe inserts returned no id');
    return;
  }
  const amId = amRow.id;
  const userId = userRow.id;
  const proxyId = proxyRow.id;

  // ════════════════════════════════════════════════════════════════════════
  // #1 — Position default (Sprint 0 model): account_manager inherits
  //      `contact.create` from position_default_permissions; the lower-privilege
  //      `trainee` position does NOT. Resolution is by position_key, not `role`.
  // ════════════════════════════════════════════════════════════════════════
  const [{ am_can }] = await pg<{ am_can: boolean }>(
    `SELECT has_permission('${amId}', 'contact.create') AS am_can`,
  );
  if (am_can === true) ok('#1 account_manager has contact.create (position default)');
  else fail('#1 AM position default', `expected true, got ${am_can}`);

  const [{ user_can }] = await pg<{ user_can: boolean }>(
    `SELECT has_permission('${userId}', 'contact.create') AS user_can`,
  );
  if (user_can === false) ok('#1 trainee does NOT have contact.create');
  else fail('#1 trainee denied contact.create', `expected false, got ${user_can}`);

  // ════════════════════════════════════════════════════════════════════════
  // #2 — NO system_admin bypass (Sprint 0 D-041): the retired role model gave
  //      system_admin a blanket bypass. The position model removed it — only
  //      `general_manager` carries the '*' wildcard. So:
  //        a) system_admin must be DENIED a permission it was never granted
  //           (invoice.cancel is not in its position defaults) — proves no bypass.
  //        b) general_manager (the '*' holder) must be GRANTED that same
  //           permission via the wildcard.
  // ════════════════════════════════════════════════════════════════════════
  const [{ admin_can }] = await pg<{ admin_can: boolean }>(
    `SELECT has_permission('${proxyId}', 'invoice.cancel') AS admin_can`,
  );
  if (admin_can === false) ok('#2a system_admin has NO bypass (denied ungranted invoice.cancel)');
  else fail('#2a no admin bypass', `expected false (bypass retired), got ${admin_can}`);

  // Resolve a general_manager profile to prove the '*' wildcard still grants.
  const gmRow = (await pg<{ id: string }>(
    `SELECT id FROM profiles WHERE position_key = 'general_manager' ORDER BY created_at LIMIT 1`,
  ))[0];
  if (!gmRow?.id) {
    fail('#2b general_manager wildcard', 'no general_manager profile found to test the wildcard');
  } else {
    const [{ gm_can }] = await pg<{ gm_can: boolean }>(
      `SELECT has_permission('${gmRow.id}', 'invoice.cancel') AS gm_can`,
    );
    if (gm_can === true) ok("#2b general_manager '*' wildcard grants invoice.cancel");
    else fail('#2b general_manager wildcard', `expected true, got ${gm_can}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // #3 — Per-user override: grant project.archive to base user → returns true
  // ════════════════════════════════════════════════════════════════════════
  await pg(`
    INSERT INTO user_permission_overrides (profile_id, permission_key, granted, reason)
    VALUES ('${userId}', 'project.archive', true, 'pillar3 smoke')
    ON CONFLICT (profile_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted, expires_at = NULL
  `);
  const [{ override_grant }] = await pg<{ override_grant: boolean }>(
    `SELECT has_permission('${userId}', 'project.archive') AS override_grant`,
  );
  if (override_grant === true) ok('#3 per-user grant override works');
  else fail('#3 per-user grant override', `expected true, got ${override_grant}`);

  // ════════════════════════════════════════════════════════════════════════
  // #4 — Override expiry: set expires_at in the past → returns false
  // ════════════════════════════════════════════════════════════════════════
  await pg(`
    UPDATE user_permission_overrides
    SET expires_at = now() - interval '1 day'
    WHERE profile_id = '${userId}' AND permission_key = 'project.archive'
  `);
  const [{ expired }] = await pg<{ expired: boolean }>(
    `SELECT has_permission('${userId}', 'project.archive') AS expired`,
  );
  if (expired === false) ok('#4 expired override no longer grants');
  else fail('#4 expired override', `expected false, got ${expired}`);

  // ════════════════════════════════════════════════════════════════════════
  // #5 — Explicit deny override (granted=false) beats the position default.
  //      account_manager has contact.create by default; a per-user deny wins.
  // ════════════════════════════════════════════════════════════════════════
  await pg(`
    INSERT INTO user_permission_overrides (profile_id, permission_key, granted, reason)
    VALUES ('${amId}', 'contact.create', false, 'pillar3 smoke deny')
    ON CONFLICT (profile_id, permission_key) DO UPDATE SET granted = false, expires_at = NULL
  `);
  const [{ denied }] = await pg<{ denied: boolean }>(
    `SELECT has_permission('${amId}', 'contact.create') AS denied`,
  );
  if (denied === false) ok('#5 explicit deny override beats position default');
  else fail('#5 deny override', `expected false, got ${denied}`);

  // ════════════════════════════════════════════════════════════════════════
  // #6 — has_capability
  // ════════════════════════════════════════════════════════════════════════
  await pg(`
    INSERT INTO user_skills (profile_id, skill_key, is_primary)
    VALUES ('${amId}', 'editor', false)
    ON CONFLICT DO NOTHING
  `);
  const [{ cap }] = await pg<{ cap: boolean }>(
    `SELECT has_capability('${amId}', 'editor') AS cap`,
  );
  if (cap === true) ok('#6 has_capability returns true after assignment');
  else fail('#6 has_capability', `expected true, got ${cap}`);

  // ════════════════════════════════════════════════════════════════════════
  // #7 — is_assigned_to_project (via account_manager FK)
  // ════════════════════════════════════════════════════════════════════════
  const cli = (await pg<{ id: string }>(
    `INSERT INTO clients (code, name_ar, client_type)
       VALUES ('PILLAR3-${stamp}', 'عميل اختبار', 'brand')
       RETURNING id`,
  ))[0];
  const proj = (await pg<{ id: string }>(
    `INSERT INTO projects (title, project_type, client_id, account_manager_id)
       VALUES ('Pillar3 Project ${stamp}', 'shoot', '${cli.id}', '${amId}')
       RETURNING id`,
  ))[0];
  const [{ assigned }] = await pg<{ assigned: boolean }>(
    `SELECT is_assigned_to_project('${amId}', '${proj.id}') AS assigned`,
  );
  if (assigned === true) ok('#7 is_assigned_to_project finds AM');
  else fail('#7 is_assigned_to_project', `expected true, got ${assigned}`);

  const [{ not_assigned }] = await pg<{ not_assigned: boolean }>(
    `SELECT is_assigned_to_project('${userId}', '${proj.id}') AS not_assigned`,
  );
  if (not_assigned === false) ok("#7 unrelated user is NOT assigned");
  else fail('#7 unrelated user assignment', `expected false, got ${not_assigned}`);

  // ════════════════════════════════════════════════════════════════════════
  // #8 — Acting-for: SET LOCAL app.acting_as + write → audit_log gets acted_as_id
  // ════════════════════════════════════════════════════════════════════════
  // We can't get current_profile_id() to resolve to a specific profile via the
  // Management API (no auth.uid()). We test the GUC propagation by writing
  // directly into activity_events via write_activity inside a transaction.
  // The trigger code path is exercised by audit_log on profile UPDATE below.

  // Trigger an UPDATE on the AM profile inside a transaction with acting_as set.
  await pg(`
    BEGIN;
    SET LOCAL "app.acting_as" = '${proxyId}';
    UPDATE profiles SET notification_prefs = '{"smoke": "pillar3"}'::jsonb WHERE id = '${amId}';
    COMMIT;
  `);
  const [{ acted_as }] = await pg<{ acted_as: string | null }>(`
    SELECT acted_as_id::text AS acted_as
    FROM audit_log
    WHERE entity_type='profiles' AND action='UPDATE' AND entity_id='${amId}'
    ORDER BY id DESC LIMIT 1
  `);
  if (acted_as === proxyId) {
    ok('#8 audit_log captures acted_as_id from SET LOCAL app.acting_as');
  } else {
    fail('#8 acting-for', `expected acted_as_id=${proxyId}, got ${acted_as}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Cleanup
  // ════════════════════════════════════════════════════════════════════════
  await pg(`DELETE FROM projects WHERE id='${proj.id}'`);
  await pg(`DELETE FROM clients WHERE id='${cli.id}'`);
  await pg(`DELETE FROM user_permission_overrides WHERE profile_id IN ('${amId}', '${userId}')`);
  await pg(`DELETE FROM user_skills WHERE profile_id='${amId}'`);
  // audit_log holds FKs to profiles via actor_id + acted_as_id — purge first.
  await pg(`
    DELETE FROM audit_log
    WHERE actor_id IN ('${amId}','${userId}','${proxyId}')
       OR acted_as_id IN ('${amId}','${userId}','${proxyId}')
  `);
  await pg(`DELETE FROM profiles WHERE id IN ('${amId}','${userId}','${proxyId}')`);

  console.log('\nCleanup complete.');

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${passed} PASS, ${failed} FAIL\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
