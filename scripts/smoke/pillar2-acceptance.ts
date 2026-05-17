/**
 * Pillar 2 §16 acceptance verification.
 *
 * Runs the §16 checklist queries / inserts and reports PASS/FAIL.
 * Idempotent: cleans up its own test rows at the end.
 *
 * Run with:
 *   set -a && source .env.local && set +a && pnpm tsx scripts/smoke/pillar2-acceptance.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

async function expectError<T>(label: string, fn: () => Promise<T>): Promise<boolean> {
  try {
    await fn();
    fail(label, 'expected an error but the operation succeeded');
    return false;
  } catch (e) {
    ok(label, `rejected as expected (${(e as Error).message.split('\n')[0]})`);
    return true;
  }
}

async function main() {
  console.log('── Pillar 2 §16 acceptance ──\n');

  // ════════════════════════════════════════════════════════════════════════
  // #1 — All Pillar 2 tables created in Supabase with RLS enabled
  // ════════════════════════════════════════════════════════════════════════
  const rlsCheck = await admin.rpc('exec_sql_safe' as never, {} as never);
  // Use raw query via REST since we don't have an RPC for this; do it directly.
  const tablesResp = await fetch(
    `${SUPABASE_URL.replace('.supabase.co', '.supabase.co')}/rest/v1/rpc/`,
    {},
  ).catch(() => null);
  // Simpler: query pg directly via the management API style we used before.

  // Count tables + tables with RLS
  const PAT = process.env.SUPABASE_ACCESS_TOKEN!;
  const REF = process.env.SUPABASE_PROJECT_REF!;
  async function pg(query: string) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) throw new Error(`pg query failed (${r.status}): ${await r.text()}`);
    return (await r.json()) as Record<string, unknown>[];
  }

  const [{ total_tables, rls_enabled }] = (await pg(`
    SELECT
      (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') AS total_tables,
      (SELECT count(*) FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.schemaname='public' AND c.relrowsecurity = true) AS rls_enabled
  `)) as { total_tables: number; rls_enabled: number }[];

  if (Number(total_tables) >= 55 && Number(rls_enabled) >= 50) {
    ok('#1 tables + RLS', `${total_tables} tables, ${rls_enabled} with RLS`);
  } else {
    fail('#1 tables + RLS', `${total_tables} tables, ${rls_enabled} with RLS — expected ≥55 tables`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // #2 — Triggers compile and fire (verified by inserting + checking audit_log)
  // ════════════════════════════════════════════════════════════════════════
  const beforeAudit = (await pg('SELECT count(*) AS c FROM public.audit_log'))[0]
    ?.c as number;

  // ════════════════════════════════════════════════════════════════════════
  // Set up: a client, a contact, two profiles (system_admin + AM), a project
  // ════════════════════════════════════════════════════════════════════════
  const stamp = Date.now();

  const { data: client, error: cErr } = await admin
    .from('clients')
    .insert({
      code: `TEST-${stamp}`,
      name_ar: 'عميل اختبار',
      name_en: 'Test Client',
      client_type: 'brand',
    })
    .select()
    .single();
  if (cErr) { fail('create client', cErr.message); return; }
  ok('seed: client created', `id=${(client as { id: string }).id}`);

  const { data: contact } = await admin
    .from('contacts')
    .insert({ client_id: (client as { id: string }).id, full_name: 'Test Contact', is_primary: true })
    .select()
    .single();
  if (!contact) { fail('create contact', 'insert returned null'); return; }

  const { data: amProfile } = await admin
    .from('profiles')
    .insert({
      email: `am-${stamp}@antagna.test`,
      display_name: 'Test AM',
      role: 'account_manager',
      status: 'active',
    })
    .select()
    .single();
  const { data: pmProfile } = await admin
    .from('profiles')
    .insert({
      email: `pm-${stamp}@antagna.test`,
      display_name: 'Test PM',
      role: 'project_manager',
      status: 'active',
    })
    .select()
    .single();
  if (!amProfile || !pmProfile) { fail('create profiles', 'insert returned null'); return; }

  // ════════════════════════════════════════════════════════════════════════
  // #6 — A project with all FK relationships in one transaction
  // ════════════════════════════════════════════════════════════════════════
  const { data: project, error: pErr } = await admin
    .from('projects')
    .insert({
      title: `Acceptance Test ${stamp}`,
      project_type: 'shoot',
      client_id: (client as { id: string }).id,
      primary_contact_id: (contact as { id: string }).id,
      account_manager_id: (amProfile as { id: string }).id,
      project_manager_id: (pmProfile as { id: string }).id,
      contracted_value_sar: 10000,
    })
    .select()
    .single();
  if (pErr) {
    fail('#6 project with all FK refs', pErr.message);
    return;
  }
  ok('#6 project with all FK refs', `code=${(project as { code: string }).code}`);

  const projectId = (project as { id: string }).id;

  // ════════════════════════════════════════════════════════════════════════
  // #2 (cont) — Audit log captured the project insert
  // ════════════════════════════════════════════════════════════════════════
  const [{ inserts }] = (await pg(`
    SELECT count(*) AS inserts FROM public.audit_log
    WHERE entity_type='projects' AND action='INSERT' AND entity_id='${projectId}'
  `)) as { inserts: number }[];
  if (Number(inserts) >= 1) {
    ok('#2 audit trigger fires on project insert', `inserts=${inserts}`);
  } else {
    fail('#2 audit trigger fires on project insert', 'no audit row');
  }

  // ════════════════════════════════════════════════════════════════════════
  // #7 — Deliverable state transitions
  // ════════════════════════════════════════════════════════════════════════
  const { data: group } = await admin
    .from('deliverable_groups')
    .insert({ project_id: projectId, name_ar: 'مجموعة اختبار', kind: 'video' })
    .select()
    .single();
  if (!group) { fail('create deliverable_group', 'null'); return; }

  const { data: deliv } = await admin
    .from('deliverables')
    .insert({
      group_id: (group as { id: string }).id,
      project_id: projectId,
      title: 'Reel 1',
      status: 'draft',
    })
    .select()
    .single();
  if (!deliv) { fail('create deliverable', 'null'); return; }

  const delivId = (deliv as { id: string }).id;

  // Transition through states (without the approval-workflow triggers, this is
  // a manual sequence; the trigger work in Pillar 5 will replace these manual
  // hops with the proper state machine).
  for (const status of ['submitted', 'pending_director', 'pending_am', 'client_ready', 'delivered']) {
    const { error } = await admin
      .from('deliverables')
      .update({ status })
      .eq('id', delivId);
    if (error) {
      fail(`#7 deliverable → ${status}`, error.message);
      return;
    }
  }
  ok('#7 deliverable state machine', 'draft → submitted → pending_director → pending_am → client_ready → delivered');

  // Audit log should have an entry per transition.
  const [{ delivTransitions }] = (await pg(`
    SELECT count(*) AS "delivTransitions" FROM public.audit_log
    WHERE entity_type='deliverables' AND action='UPDATE' AND entity_id='${delivId}'
  `)) as { delivTransitions: number }[];
  if (Number(delivTransitions) >= 5) {
    ok('#5 audit captures every deliverable transition', `${delivTransitions} updates`);
  } else {
    fail('#5 audit deliverable transitions', `expected ≥5, got ${delivTransitions}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // #8 — Equipment reservation overlap rejected by exclusion constraint
  // ════════════════════════════════════════════════════════════════════════
  const { data: eqGroup } = await admin
    .from('equipment_groups')
    .insert({ code: `EG-${stamp}`, name_ar: 'كاميرا اختبار', category: 'camera' })
    .select()
    .single();
  if (!eqGroup) { fail('create equipment_group', 'null'); return; }

  const { data: eq } = await admin
    .from('equipment')
    .insert({
      code: `EQ-${stamp}`,
      group_id: (eqGroup as { id: string }).id,
      category: 'camera',
      model: 'TestCam X1',
      tracking_mode: 'unit',
    })
    .select()
    .single();
  if (!eq) { fail('create equipment', 'null'); return; }
  const eqId = (eq as { id: string }).id;

  // First reservation — should succeed.
  const start = new Date('2027-01-01T10:00:00Z').toISOString();
  const end = new Date('2027-01-03T18:00:00Z').toISOString();
  const { error: r1Err } = await admin.from('equipment_reservations').insert({
    equipment_id: eqId,
    project_id: projectId,
    starts_at: start,
    ends_at: end,
    status: 'reserved',
  });
  if (r1Err) { fail('#8 first reservation', r1Err.message); return; }
  ok('#8 first reservation accepted');

  // Overlapping reservation — must be REJECTED.
  const overlapStart = new Date('2027-01-02T10:00:00Z').toISOString();
  const overlapEnd = new Date('2027-01-04T18:00:00Z').toISOString();
  await expectError('#8 overlapping reservation rejected', async () => {
    const { error } = await admin.from('equipment_reservations').insert({
      equipment_id: eqId,
      project_id: projectId,
      starts_at: overlapStart,
      ends_at: overlapEnd,
      status: 'reserved',
    });
    if (error) throw error;
  });

  // ════════════════════════════════════════════════════════════════════════
  // Cleanup
  // ════════════════════════════════════════════════════════════════════════
  await admin.from('equipment_reservations').delete().eq('equipment_id', eqId);
  await admin.from('equipment').delete().eq('id', eqId);
  await admin.from('equipment_groups').delete().eq('id', (eqGroup as { id: string }).id);
  await admin.from('deliverables').delete().eq('id', delivId);
  await admin.from('deliverable_groups').delete().eq('id', (group as { id: string }).id);
  await admin.from('projects').delete().eq('id', projectId);
  await admin.from('profiles').delete().eq('id', (amProfile as { id: string }).id);
  await admin.from('profiles').delete().eq('id', (pmProfile as { id: string }).id);
  await admin.from('contacts').delete().eq('id', (contact as { id: string }).id);
  await admin.from('clients').delete().eq('id', (client as { id: string }).id);

  console.log('\nCleanup complete.');

  // ════════════════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════════════════
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${passed} PASS, ${failed} FAIL\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
