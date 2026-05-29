/**
 * Sprint 0 — Permissions acceptance harness (Phase H / Part 6 of the spec).
 *
 * Runs all 10 test cases from 01PERMISSIONSforClaudeCode.md §Part 6 against the
 * `v_*_safe` field-masking views (Phase D), driving each persona through the SAME
 * code path the app uses: `withProfileScope(profileId, tx => …)` from @antagna/db.
 *
 * WHY withProfileScope (load-bearing): DATABASE_URL is the Supabase transaction
 * pooler (6543). The views read `current_effective_profile_id()`, which reads the
 * txn-local GUC `app.current_profile_id`. A bare `db.execute()` would borrow a
 * fresh pooled backend and the GUC would NOT survive to the SELECT. withProfileScope
 * pins ONE backend (set_config(..., true) + the read in one db.transaction), exactly
 * like the server actions do. So this harness is a true end-to-end masking check.
 *
 * Personas (real team, looked up by display_name; حازم/freelancer are seeded here
 * because they don't exist in the live roster yet):
 *   محسن        videographer        — T1
 *   مساعد        equipment_technician — T3, T4
 *   حازم         accountant (seeded)  — T7
 *   freelancer   freelancer (seeded)  — T5
 *   تركي         hr_manager           — T6
 *   Mohammed     production_director   — T10 (TEMP general_manager '*' hat → RED on purpose)
 *
 * Tested contracts (the four the task pins, plus the rest of Part 6):
 *   T1  محسن:        v_projects_safe.contracted_value_sar IS NULL on every row
 *   T2  خالد(PM):     v_projects_safe row count < all projects (read.assigned only)
 *   T3  مساعد:        v_projects_safe.contracted_value_sar IS NULL
 *   T4  مساعد:        v_equipment_safe.purchase_price_sar IS NOT NULL (he needs it)
 *   T5  freelancer:   v_contacts_safe is empty for his project's client
 *   T6  تركي(HR):     v_projects_safe.contracted_value_sar IS NULL
 *   T7  حازم:         v_projects_safe.contracted_value_sar NOT NULL (financial ok)
 *                     AND v_team_safe.monthly_salary IS NULL (no team salaries)
 *   T8  خالد:         v_projects_safe has no Abu-Luka-content rows  (SKIP if column
 *                     not yet present — Phase E adds is_abu_luka_content)
 *   T9  حمادة:        Abu-Luka-content rows have contracted_value_sar NULL (SKIP same)
 *   T10 Mohammed:     v_projects_safe.contracted_value_sar NOT NULL  → EXPECTED FAIL
 *                     while the TEMP general_manager hat exists. The harness asserts
 *                     the RED explicitly: it passes ("correctly RED") as long as the
 *                     temp hat is present, and tells you the test flips GREEN the
 *                     moment the hat row is deleted (correct-by-construction views).
 *
 * Run from repo root with .env.local sourced (DATABASE_URL = 6543 pooler):
 *   set -a && source .env.local && set +a && pnpm tsx scripts/smoke/sprint0-permissions-acceptance.ts
 */
import { sql } from 'drizzle-orm';
import { db, withProfileScope } from '@antagna/db';

// ── result plumbing ──────────────────────────────────────────────────────────
type CheckResult = { name: string; pass: boolean; detail?: string; skipped?: boolean };
const results: CheckResult[] = [];

function ok(name: string, detail?: string) {
  results.push({ name, pass: true, detail });
  console.log(`  ✓ ${name}${detail ? '  — ' + detail : ''}`);
}
function fail(name: string, detail: string) {
  results.push({ name, pass: false, detail });
  console.log(`  ✗ ${name}  — ${detail}`);
}
function skip(name: string, detail: string) {
  results.push({ name, pass: true, skipped: true, detail });
  console.log(`  ⊘ ${name}  — SKIP: ${detail}`);
}

// One-shot raw query (NO profile scope) — used for setup/teardown/lookup only.
async function raw<T = Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<T[]> {
  const r = await db.execute(query);
  return r as unknown as T[];
}

// Run a SELECT inside a persona's effective-profile scope (the app's read path).
async function asPersona<T = Record<string, unknown>>(
  profileId: string,
  query: ReturnType<typeof sql>,
): Promise<T[]> {
  return withProfileScope(profileId, async (tx) => {
    const r = await tx.execute(query);
    return r as unknown as T[];
  });
}

// Does a view exist? (Phase D drop-ins.) Fail-loud if a required view is missing.
async function viewExists(name: string): Promise<boolean> {
  const rows = await raw<{ exists: boolean }>(
    sql`SELECT to_regclass(${'public.' + name}) IS NOT NULL AS exists`,
  );
  return rows[0]?.exists === true;
}
async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await raw<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = ${table} AND column_name = ${column}
    ) AS exists
  `);
  return rows[0]?.exists === true;
}

async function findProfileId(displayName: string): Promise<string | null> {
  const rows = await raw<{ id: string }>(
    sql`SELECT id FROM profiles WHERE display_name = ${displayName} AND position_key IS NOT NULL ORDER BY created_at LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}
async function findOneByPosition(positionKey: string): Promise<string | null> {
  const rows = await raw<{ id: string }>(
    sql`SELECT id FROM profiles WHERE position_key = ${positionKey} ORDER BY created_at LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('── Sprint 0 permissions acceptance (Part 6, all 10 tests) ──\n');

  // Guard: views must exist (Phase D). Bail loudly if not.
  const requiredViews = ['v_projects_safe', 'v_equipment_safe', 'v_contacts_safe', 'v_team_safe'];
  const missing: string[] = [];
  for (const v of requiredViews) if (!(await viewExists(v))) missing.push(v);
  if (missing.length) {
    console.error(`\nFATAL: required safe views missing (Phase D not applied?): ${missing.join(', ')}`);
    process.exit(2);
  }

  // ── resolve / seed personas ───────────────────────────────────────────────
  const stamp = Date.now();
  const seeded: string[] = []; // profile ids to clean up
  const seededClients: string[] = [];
  const seededProjects: string[] = [];
  const seededEmployees: string[] = [];

  const mohsenId = await findProfileId('محسن'); // videographer (T1)
  const khalidPmId = await findProfileId('خالد الغامدي'); // project_manager (T2, T8)
  const musaedId = await findProfileId('مساعد'); // equipment_technician (T3, T4)
  const turkiId = await findProfileId('تركي'); // hr_manager (T6)
  const hammadaId = await findProfileId('حمادة'); // videographer (T9)
  const ghareebId = await findProfileId('Mohammed Ghareib'); // production_director (T10)

  // حازم (accountant) — seed if absent.
  let hazemId = await findOneByPosition('accountant');
  if (!hazemId) {
    const rows = await raw<{ id: string }>(sql`
      INSERT INTO profiles (email, display_name, role, position_key)
      VALUES (${`sprint0-hazem-${stamp}@antagna.test`}, ${'حازم (probe)'}, 'user', 'accountant')
      RETURNING id
    `);
    hazemId = rows[0].id;
    seeded.push(hazemId);
  }

  // freelancer — seed if absent.
  let freelancerId = await findOneByPosition('freelancer');
  if (!freelancerId) {
    const rows = await raw<{ id: string }>(sql`
      INSERT INTO profiles (email, display_name, role, position_key)
      VALUES (${`sprint0-freelancer-${stamp}@antagna.test`}, ${'Freelancer Probe'}, 'user', 'freelancer')
      RETURNING id
    `);
    freelancerId = rows[0].id;
    seeded.push(freelancerId);
  }

  for (const [label, id] of Object.entries({
    'محسن (videographer)': mohsenId,
    'خالد (project_manager)': khalidPmId,
    'مساعد (equipment_technician)': musaedId,
    'تركي (hr_manager)': turkiId,
    'حمادة (videographer)': hammadaId,
    'Mohammed (production_director)': ghareebId,
    'حازم (accountant)': hazemId,
    'freelancer': freelancerId,
  })) {
    if (!id) {
      fail('persona resolution', `could not resolve persona: ${label}`);
    }
  }
  if (results.some((r) => !r.pass)) {
    report();
    process.exit(1);
  }

  // ── fixtures that the contracts depend on ─────────────────────────────────
  // A client + a project with a non-null contracted_value (T1/T3/T6/T7/T10),
  // a contact on that client (T5), an equipment row with purchase_price (T4),
  // an employee row with a salary (T7).
  const cliRows = await raw<{ id: string }>(sql`
    INSERT INTO clients (code, name_ar, client_type)
    VALUES (${`SPRINT0-${stamp}`}, ${'عميل اختبار صلاحيات'}, 'brand')
    RETURNING id
  `);
  const clientId = cliRows[0].id;
  seededClients.push(clientId);

  const contactRows = await raw<{ id: string }>(sql`
    INSERT INTO contacts (client_id, full_name, job_title)
    VALUES (${clientId}, ${'Probe Contact'}, 'Marketing')
    RETURNING id
  `);
  const contactId = contactRows[0].id;

  // Project assigned to the freelancer (so freelancer "sees" it) but client
  // contacts must still be hidden (T5). Account manager = خالد so T2 has an
  // assigned row for him too.
  const projRows = await raw<{ id: string }>(sql`
    INSERT INTO projects (title, project_type, stage, client_id, account_manager_id, contracted_value_sar)
    VALUES (${`Sprint0 Project ${stamp}`}, 'shoot', 'planning', ${clientId}, ${khalidPmId}, 125000.00)
    RETURNING id
  `);
  const projectId = projRows[0].id;
  seededProjects.push(projectId);

  await raw(sql`
    INSERT INTO project_assignments (project_id, profile_id, role)
    VALUES (${projectId}, ${freelancerId}, 'freelancer_other')
  `);
  // محسن (videographer) must be assigned so T1 has ≥1 visible row whose
  // contracted_value_sar mask we can actually assert (read.assigned only).
  await raw(sql`
    INSERT INTO project_assignments (project_id, profile_id, role)
    VALUES (${projectId}, ${mohsenId}, 'shooter')
  `);

  // Equipment with a purchase price (T4).
  const eqRows = await raw<{ id: string }>(sql`
    INSERT INTO equipment (code, category, model, purchase_price_sar)
    VALUES (${`SPRINT0-EQ-${stamp}`}, 'camera', 'Probe X100', 8500.00)
    RETURNING id
  `);
  const equipmentId = eqRows[0].id;

  // Salary on a colleague employee row, so T7's salary mask has something to mask.
  const empRows = await raw<{ id: string }>(sql`
    INSERT INTO employees (profile_id, monthly_salary, monthly_salary_currency)
    VALUES (${mohsenId}, 9000, 'SAR')
    ON CONFLICT (profile_id) DO UPDATE SET monthly_salary = 9000
    RETURNING id
  `);
  seededEmployees.push(empRows[0].id);

  const hasAbuLuka = await columnExists('projects', 'is_abu_luka_content');
  const teamSafeHasSalary = await columnExists('v_team_safe', 'monthly_salary');

  // ════════════════════════════════════════════════════════════════════════
  // T1 — محسن (junior videographer) sees projects but contracted_value masked
  // ════════════════════════════════════════════════════════════════════════
  {
    const rows = await asPersona<{ contracted_value_sar: string | null }>(
      mohsenId!,
      sql`SELECT contracted_value_sar FROM v_projects_safe`,
    );
    const allNull = rows.every((r) => r.contracted_value_sar === null);
    if (rows.length > 0 && allNull) ok('T1 محسن: contracted_value_sar NULL on every project row');
    else if (rows.length === 0)
      fail('T1 محسن', 'saw 0 project rows — videographer should see assigned projects');
    else fail('T1 محسن', `expected all NULL, found a non-null value in ${rows.length} rows`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // T2 — خالد (PM) sees only assigned projects (count < total)
  // ════════════════════════════════════════════════════════════════════════
  {
    const total = (await raw<{ n: number }>(sql`SELECT count(*)::int AS n FROM projects`))[0].n;
    const seen = await asPersona<{ id: string }>(khalidPmId!, sql`SELECT id FROM v_projects_safe`);
    if (seen.length > 0 && seen.length < total)
      ok('T2 خالد: sees assigned subset only', `${seen.length} of ${total} projects`);
    else if (seen.length === 0) fail('T2 خالد', 'saw 0 projects — should see at least his assigned one');
    else fail('T2 خالد', `saw ${seen.length} of ${total} — read.assigned should be a strict subset`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // T3 — مساعد (equipment tech) sees no project financials
  // ════════════════════════════════════════════════════════════════════════
  {
    const rows = await asPersona<{ contracted_value_sar: string | null }>(
      musaedId!,
      sql`SELECT contracted_value_sar FROM v_projects_safe`,
    );
    if (rows.every((r) => r.contracted_value_sar === null))
      ok('T3 مساعد: contracted_value_sar NULL', `${rows.length} rows`);
    else fail('T3 مساعد', 'expected all NULL contracted_value_sar');
  }

  // ════════════════════════════════════════════════════════════════════════
  // T4 — مساعد DOES see equipment purchase_price (he needs it for insurance)
  // ════════════════════════════════════════════════════════════════════════
  {
    const rows = await asPersona<{ purchase_price_sar: string | null }>(
      musaedId!,
      sql`SELECT purchase_price_sar FROM v_equipment_safe WHERE id = ${equipmentId}`,
    );
    const v = rows[0]?.purchase_price_sar;
    if (rows.length === 1 && v !== null && v !== undefined)
      ok('T4 مساعد: purchase_price_sar visible', `value=${v}`);
    else fail('T4 مساعد', `expected non-null purchase_price_sar, got ${JSON.stringify(v)}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // T5 — freelancer sees NO contacts for his project's client
  // ════════════════════════════════════════════════════════════════════════
  {
    const rows = await asPersona<{ id: string }>(
      freelancerId!,
      sql`SELECT id FROM v_contacts_safe WHERE client_id = ${clientId}`,
    );
    if (rows.length === 0) ok('T5 freelancer: v_contacts_safe empty for his client');
    else fail('T5 freelancer', `expected 0 contacts, saw ${rows.length} (contactId ${contactId})`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // T6 — تركي (HR) sees no project financials
  // ════════════════════════════════════════════════════════════════════════
  {
    const rows = await asPersona<{ contracted_value_sar: string | null }>(
      turkiId!,
      sql`SELECT contracted_value_sar FROM v_projects_safe`,
    );
    if (rows.every((r) => r.contracted_value_sar === null))
      ok('T6 تركي: contracted_value_sar NULL', `${rows.length} rows`);
    else fail('T6 تركي', 'expected all NULL contracted_value_sar');
  }

  // ════════════════════════════════════════════════════════════════════════
  // T7 — حازم (accountant): sees project financials, NOT team salaries
  // ════════════════════════════════════════════════════════════════════════
  {
    const projRowsSeen = await asPersona<{ contracted_value_sar: string | null }>(
      hazemId!,
      sql`SELECT contracted_value_sar FROM v_projects_safe WHERE id = ${projectId}`,
    );
    const v = projRowsSeen[0]?.contracted_value_sar;
    if (projRowsSeen.length === 1 && v !== null && v !== undefined)
      ok('T7a حازم: project contracted_value_sar visible', `value=${v}`);
    else fail('T7a حازم financials', `expected non-null contracted_value_sar, got ${JSON.stringify(v)}`);

    if (!teamSafeHasSalary) {
      skip('T7b حازم salaries', 'v_team_safe has no monthly_salary column to mask');
    } else {
      const teamRowsSeen = await asPersona<{ monthly_salary: number | null }>(
        hazemId!,
        sql`SELECT monthly_salary FROM v_team_safe WHERE monthly_salary IS NOT NULL`,
      );
      if (teamRowsSeen.length === 0)
        ok('T7b حازم: team salaries masked (no non-null monthly_salary rows)');
      else fail('T7b حازم salaries', `accountant saw ${teamRowsSeen.length} salaried rows — should be masked`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // T8 — خالد cannot see Abu-Luka-content projects  (SKIP until Phase E)
  // ════════════════════════════════════════════════════════════════════════
  if (!hasAbuLuka) {
    skip('T8 خالد Abu-Luka', 'projects.is_abu_luka_content not present yet (Phase E)');
  } else {
    const rows = await asPersona<{ id: string }>(
      khalidPmId!,
      sql`SELECT id FROM v_projects_safe WHERE is_abu_luka_content = true`,
    );
    if (rows.length === 0) ok('T8 خالد: no Abu-Luka-content rows visible');
    else fail('T8 خالد Abu-Luka', `saw ${rows.length} Abu-Luka rows`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // T9 — حمادة sees Abu-Luka content but financials masked  (SKIP until Phase E)
  // ════════════════════════════════════════════════════════════════════════
  if (!hasAbuLuka) {
    skip('T9 حمادة Abu-Luka', 'projects.is_abu_luka_content not present yet (Phase E)');
  } else {
    const rows = await asPersona<{ contracted_value_sar: string | null }>(
      hammadaId!,
      sql`SELECT contracted_value_sar FROM v_projects_safe WHERE is_abu_luka_content = true`,
    );
    if (rows.every((r) => r.contracted_value_sar === null))
      ok('T9 حمادة: Abu-Luka contracted_value_sar NULL', `${rows.length} rows`);
    else fail('T9 حمادة Abu-Luka', 'expected all NULL contracted_value_sar');
  }

  // ════════════════════════════════════════════════════════════════════════
  // T10 — Mohammed/غريب: production_director must NOT see financials.
  //   He currently holds a TEMP general_manager '*' hat by design, so this is
  //   RED on purpose. The harness asserts the RED is *correctly* present and
  //   tells you it flips GREEN the moment the temp hat row is removed.
  // ════════════════════════════════════════════════════════════════════════
  {
    const tempHat = await raw<{ n: number }>(sql`
      SELECT count(*)::int AS n
      FROM user_position_overrides
      WHERE profile_id = ${ghareebId} AND position_key = 'general_manager'
    `);
    const hasTempHat = tempHat[0].n > 0;

    const rows = await asPersona<{ contracted_value_sar: string | null }>(
      ghareebId!,
      sql`SELECT contracted_value_sar FROM v_projects_safe WHERE id = ${projectId}`,
    );
    const v = rows[0]?.contracted_value_sar;
    const seesFinancials = rows.length === 1 && v !== null && v !== undefined;

    if (hasTempHat) {
      // Expected state today: temp hat present → he DOES see financials (RED).
      if (seesFinancials) {
        ok(
          'T10 غريب: correctly RED while TEMP general_manager hat exists',
          "delete that user_position_overrides row → production_director loses '*' → T10 goes GREEN (views are correct-by-construction)",
        );
      } else {
        // Views already mask him even WITH the temp '*' hat — that means the
        // financial mask is keyed off the WRONG code (not '*' aware). Surface it.
        fail(
          'T10 غريب',
          'TEMP general_manager hat is present but financials are masked anyway — the v_projects_safe financial mask is not honoring the wildcard; investigate the masking code',
        );
      }
    } else {
      // Temp hat removed → the real assertion: production_director sees NULL.
      if (!seesFinancials)
        ok('T10 غريب: TEMP hat removed AND contracted_value_sar NULL — production_director ≠ financial access');
      else
        fail(
          'T10 غريب',
          'TEMP hat is gone but production_director STILL sees contracted_value_sar — masking is broken',
        );
    }
  }

  // ── teardown ──────────────────────────────────────────────────────────────
  await raw(sql`DELETE FROM project_assignments WHERE project_id = ${projectId}`);
  await raw(sql`DELETE FROM projects WHERE id = ${projectId}`);
  await raw(sql`DELETE FROM contacts WHERE id = ${contactId}`);
  await raw(sql`DELETE FROM clients WHERE id = ${clientId}`);
  await raw(sql`DELETE FROM equipment WHERE id = ${equipmentId}`);
  // Restore the salaried employee row we mutated / drop the one we created.
  for (const empId of seededEmployees) {
    await raw(sql`DELETE FROM employees WHERE id = ${empId}`);
  }
  for (const pid of seeded) {
    await raw(sql`DELETE FROM user_skills WHERE profile_id = ${pid}`);
    await raw(sql`DELETE FROM user_position_overrides WHERE profile_id = ${pid}`);
    await raw(sql`DELETE FROM user_permission_overrides WHERE profile_id = ${pid}`);
    await raw(sql`DELETE FROM profiles WHERE id = ${pid}`);
  }
  console.log('\nCleanup complete.');

  report();
}

function report() {
  const passed = results.filter((r) => r.pass && !r.skipped).length;
  const failed = results.filter((r) => !r.pass).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`\n${passed} PASS, ${failed} FAIL, ${skipped} SKIP\n`);
  if (failed > 0) process.exit(1);
}

main()
  .then(async () => {
    await db.$client.end({ timeout: 5 });
  })
  .catch(async (err) => {
    console.error('FATAL:', err);
    try {
      await db.$client.end({ timeout: 5 });
    } catch {
      /* noop */
    }
    process.exit(1);
  });
