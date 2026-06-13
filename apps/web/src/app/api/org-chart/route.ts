import { NextResponse } from 'next/server';
import { db } from '@antagna/db';
import { sql } from 'drizzle-orm';

// PUBLIC, no-auth org-chart document (structure.antagna.me). The table is a
// single shared tree; this route is the only way in/out. Service-role DB conn,
// so we validate hard here instead of relying on RLS.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEPTS = new Set([
  'leadership', 'management', 'commercial', 'production', 'finance', 'admin',
]);
const MAX_NODES = 500;
const STR = (v: unknown, max: number) => String(v ?? '').slice(0, max);

interface OrgNode {
  id: string;
  parentId: string | null;
  name: string;
  role: string;
  dept: string;
  vacant: boolean;
}

export async function GET() {
  try {
    const rows = (await db.execute(sql`
      SELECT id, parent_id AS "parentId", name, role, dept, vacant
      FROM org_nodes
      ORDER BY position, id
    `)) as unknown as OrgNode[];
    return NextResponse.json({ ok: true, nodes: rows });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  let body: { nodes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const raw = Array.isArray(body.nodes) ? body.nodes : null;
  if (!raw) return NextResponse.json({ ok: false, error: 'nodes_required' }, { status: 400 });
  if (raw.length === 0 || raw.length > MAX_NODES) {
    return NextResponse.json({ ok: false, error: 'bad_count' }, { status: 400 });
  }

  // Normalize + validate.
  const nodes: OrgNode[] = [];
  const ids = new Set<string>();
  for (const r of raw as Record<string, unknown>[]) {
    const id = STR(r.id, 64);
    if (!id || ids.has(id)) {
      return NextResponse.json({ ok: false, error: 'bad_id' }, { status: 400 });
    }
    ids.add(id);
    nodes.push({
      id,
      parentId: r.parentId == null ? null : STR(r.parentId, 64),
      name: STR(r.name, 120) || '—',
      role: STR(r.role, 160),
      dept: DEPTS.has(String(r.dept)) ? String(r.dept) : 'production',
      vacant: r.vacant === true,
    });
  }

  // Structural integrity: every parentId must exist; exactly one root; no cycles.
  let roots = 0;
  for (const n of nodes) {
    if (n.parentId == null) { roots++; continue; }
    if (!ids.has(n.parentId)) {
      return NextResponse.json({ ok: false, error: 'orphan_parent' }, { status: 400 });
    }
  }
  if (roots !== 1) return NextResponse.json({ ok: false, error: 'need_one_root' }, { status: 400 });

  const parentOf = new Map(nodes.map((n) => [n.id, n.parentId]));
  for (const n of nodes) {
    let hops = 0;
    let cur = n.parentId;
    while (cur != null) {
      if (cur === n.id || hops++ > nodes.length) {
        return NextResponse.json({ ok: false, error: 'cycle' }, { status: 400 });
      }
      cur = parentOf.get(cur) ?? null;
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM org_nodes`);
      // Pass 1: insert every node parentless so FK never trips on order.
      let pos = 0;
      for (const n of nodes) {
        await tx.execute(sql`
          INSERT INTO org_nodes (id, parent_id, name, role, dept, vacant, position, updated_at)
          VALUES (${n.id}, NULL, ${n.name}, ${n.role}, ${n.dept}, ${n.vacant}, ${pos++}, now())
        `);
      }
      // Pass 2: wire parents now that all ids exist.
      for (const n of nodes) {
        if (n.parentId != null) {
          await tx.execute(sql`UPDATE org_nodes SET parent_id = ${n.parentId} WHERE id = ${n.id}`);
        }
      }
    });
    return NextResponse.json({ ok: true, count: nodes.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
