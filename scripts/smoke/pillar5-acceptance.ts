/**
 * Pillar 5 §10 acceptance verification.
 *
 * - state-machine trigger rejects illegal transitions
 * - stage-entry hook spawns canonical tasks
 * - auto-deliver flips the project when all deliverables are delivered
 * - fn_create_project_from_template materializes a project + groups + tasks
 * - fn_get_shared_project (portal RPC) returns redacted payload
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
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`pg ${r.status}: ${text}`);
  return JSON.parse(text) as T[];
}

async function expectError(label: string, q: string) {
  try {
    await pg(q);
    fail(label, 'expected error, query succeeded');
  } catch (e) {
    ok(label, `rejected: ${(e as Error).message.split('\n')[0].slice(0, 120)}`);
  }
}

async function main() {
  console.log('── Pillar 5 §10 acceptance ──\n');
  const stamp = Date.now();

  // Setup: client + project at stage='brief'
  const cli = (await pg<{ id: string }>(
    `INSERT INTO clients (code, name_ar, client_type)
       VALUES ('P5-${stamp}', 'P5 عميل اختبار', 'brand')
       RETURNING id`,
  ))[0];
  const proj = (await pg<{ id: string; code: string }>(
    `INSERT INTO projects (title, project_type, client_id)
       VALUES ('Pillar5 ${stamp}', 'shoot', '${cli.id}')
       RETURNING id, code`,
  ))[0];

  ok('seed: project created', `code=${proj.code}`);

  // ── #1 state-machine: invalid transition rejected ────────────────────────
  await expectError(
    '#1 illegal transition brief → shooting rejected',
    `UPDATE projects SET stage = 'shooting' WHERE id = '${proj.id}'`,
  );

  // ── #2 valid forward transitions trigger stage-entry tasks ──────────────
  await pg(`UPDATE projects SET stage='quoted'   WHERE id = '${proj.id}'`);
  await pg(`UPDATE projects SET stage='approved' WHERE id = '${proj.id}'`);
  await pg(`UPDATE projects SET stage='planning' WHERE id = '${proj.id}'`);

  const [{ task_count }] = await pg<{ task_count: number }>(
    `SELECT count(*) AS task_count FROM project_tasks WHERE project_id = '${proj.id}'`,
  );
  // brief stage entered on insert (none), then quoted (3) + approved (3) + planning (6) = 12
  if (Number(task_count) >= 12) {
    ok('#2 stage-entry hook spawned tasks', `${task_count} tasks total after 3 stage moves`);
  } else {
    fail('#2 stage-entry tasks', `expected ≥12, got ${task_count}`);
  }

  // ── #3 project_stages_log captures every transition ──────────────────────
  const [{ stage_log }] = await pg<{ stage_log: number }>(
    `SELECT count(*) AS stage_log FROM project_stages_log WHERE project_id = '${proj.id}'`,
  );
  if (Number(stage_log) >= 3) {
    ok('#3 project_stages_log captured transitions', `${stage_log} rows`);
  } else {
    fail('#3 stage log', `expected ≥3, got ${stage_log}`);
  }

  // ── #4 auto-deliver: move to review with deliverables, deliver all → project goes to delivered ──
  await pg(`UPDATE projects SET stage='shooting' WHERE id = '${proj.id}'`);
  await pg(`UPDATE projects SET stage='editing'  WHERE id = '${proj.id}'`);
  await pg(`UPDATE projects SET stage='review'   WHERE id = '${proj.id}'`);

  const dg = (await pg<{ id: string }>(
    `INSERT INTO deliverable_groups (project_id, name_ar, kind)
       VALUES ('${proj.id}', 'مخرجات الاختبار', 'video') RETURNING id`,
  ))[0];

  await pg(`INSERT INTO deliverables (group_id, project_id, title, status) VALUES
            ('${dg.id}', '${proj.id}', 'A', 'delivered'),
            ('${dg.id}', '${proj.id}', 'B', 'delivered'),
            ('${dg.id}', '${proj.id}', 'C', 'submitted')`);

  // C still not delivered → project should stay in 'review'.
  const [{ stage_a }] = await pg<{ stage_a: string }>(
    `SELECT stage::text AS stage_a FROM projects WHERE id = '${proj.id}'`,
  );
  if (stage_a === 'review') {
    ok('#4 auto-deliver does NOT fire while some deliverables not delivered');
  } else {
    fail('#4 auto-deliver early fire', `expected stage=review, got ${stage_a}`);
  }

  // Now mark the last one delivered → auto-deliver should advance the project.
  await pg(
    `UPDATE deliverables SET status='delivered'
       WHERE project_id = '${proj.id}' AND title='C'`,
  );
  const [{ stage_b }] = await pg<{ stage_b: string }>(
    `SELECT stage::text AS stage_b FROM projects WHERE id = '${proj.id}'`,
  );
  if (stage_b === 'delivered') {
    ok('#4 auto-deliver fired when all deliverables delivered');
  } else {
    fail('#4 auto-deliver final', `expected stage=delivered, got ${stage_b}`);
  }

  // ── #5 fn_create_project_from_template ──────────────────────────────────
  const tpl = (await pg<{ id: string }>(
    `INSERT INTO project_templates (code, name_ar, payload)
       VALUES (
         'TPL-${stamp}',
         'قالب اختبار',
         jsonb_build_object(
           'default_deliverable_groups', jsonb_build_array(
             jsonb_build_object('name_ar','ريلز','name_en','Reels','kind','reels'),
             jsonb_build_object('name_ar','صور','name_en','Photos','kind','photos')
           ),
           'default_tasks', jsonb_build_array(
             jsonb_build_object('title','Kickoff call','description','Brief client kickoff')
           )
         )
       ) RETURNING id`,
  ))[0];

  const tpl_proj = (await pg<{ new_id: string }>(
    `SELECT fn_create_project_from_template('${tpl.id}', '${cli.id}', 'From template ${stamp}', 'shoot') AS new_id`,
  ))[0];

  const [{ groups, tasks }] = await pg<{ groups: number; tasks: number }>(
    `SELECT
       (SELECT count(*) FROM deliverable_groups WHERE project_id='${tpl_proj.new_id}') AS groups,
       (SELECT count(*) FROM project_tasks WHERE project_id='${tpl_proj.new_id}') AS tasks`,
  );

  if (Number(groups) === 2 && Number(tasks) >= 1) {
    ok('#5 fn_create_project_from_template', `groups=${groups}, tasks=${tasks}`);
  } else {
    fail('#5 template instantiation', `groups=${groups} (expected 2), tasks=${tasks} (expected ≥1)`);
  }

  // ── #6 fn_get_shared_project (portal RPC) ───────────────────────────────
  const sv = (await pg<{ share_token: string }>(
    `INSERT INTO project_share_views (project_id, audience_label, show_sections)
       VALUES ('${proj.id}', 'Client review', ARRAY['overview','deliverables'])
       RETURNING share_token::text`,
  ))[0];

  const [{ payload }] = await pg<{ payload: { project?: { code?: string }; deliverables?: unknown[] } }>(
    `SELECT fn_get_shared_project('${sv.share_token}'::uuid) AS payload`,
  );
  if (payload?.project?.code === proj.code && Array.isArray(payload?.deliverables)) {
    ok('#6 portal RPC returns redacted payload', `code=${payload.project.code}, deliverables=${payload.deliverables.length}`);
  } else {
    fail('#6 portal RPC', `unexpected payload: ${JSON.stringify(payload).slice(0, 120)}`);
  }

  // Revoke → returns error.
  await pg(
    `UPDATE project_share_views SET revoked_at = now() WHERE share_token = '${sv.share_token}'::uuid`,
  );
  const [{ revoked }] = await pg<{ revoked: { error?: string } }>(
    `SELECT fn_get_shared_project('${sv.share_token}'::uuid) AS revoked`,
  );
  if (revoked?.error === 'invalid_or_expired_token') {
    ok('#6b revoked share token rejected');
  } else {
    fail('#6b revoke', `unexpected: ${JSON.stringify(revoked)}`);
  }

  // ── cleanup ─────────────────────────────────────────────────────────────
  await pg(`
    DELETE FROM deliverables          WHERE project_id IN ('${proj.id}', '${tpl_proj.new_id}');
    DELETE FROM deliverable_groups    WHERE project_id IN ('${proj.id}', '${tpl_proj.new_id}');
    DELETE FROM project_tasks         WHERE project_id IN ('${proj.id}', '${tpl_proj.new_id}');
    DELETE FROM project_stages_log    WHERE project_id IN ('${proj.id}', '${tpl_proj.new_id}');
    DELETE FROM project_share_views   WHERE project_id = '${proj.id}';
    DELETE FROM activity_events       WHERE project_id IN ('${proj.id}', '${tpl_proj.new_id}');
    DELETE FROM projects              WHERE id IN ('${proj.id}', '${tpl_proj.new_id}');
    DELETE FROM project_templates     WHERE id = '${tpl.id}';
    DELETE FROM clients               WHERE id = '${cli.id}';
  `);
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
