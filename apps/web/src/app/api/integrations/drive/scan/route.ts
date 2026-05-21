import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getAdminUser } from '@/lib/auth-admin';
import { ensureProjectFolderTree } from '@/lib/drive';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type ProjectRow = {
  id: string;
  code: string;
  title: string;
  client_code: string | null;
  created_year: number;
  [k: string]: unknown;
};

/**
 * Scan projects missing a Drive folder and create the folder tree for each.
 * Capped at ?max=10 per run so a single call can't get stuck for minutes.
 *
 * Auth: admin OR Bearer CRON_SECRET (called by the worker every 2 min).
 */
export async function POST(req: Request) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const cronSecret = process.env.CRON_SECRET;
  const viaCron = !!(bearer && cronSecret && bearer === cronSecret);

  if (!viaCron) {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
  }

  const url = new URL(req.url);
  const max = Math.min(
    50,
    Math.max(1, parseInt(url.searchParams.get('max') ?? '10', 10) || 10),
  );

  const rows = await db.execute<ProjectRow>(sql`
    SELECT
      p.id::text AS id,
      p.code,
      p.title,
      c.code AS client_code,
      EXTRACT(YEAR FROM p.created_at)::int AS created_year
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.drive_folder_id IS NULL
      AND p.archived_at IS NULL
    ORDER BY p.created_at DESC
    LIMIT ${max}
  `);
  const projects = rows as unknown as ProjectRow[];

  const created: { id: string; folderId: string }[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const p of projects) {
    try {
      const tree = await ensureProjectFolderTree({
        projectCode: p.code,
        projectTitle: p.title,
        clientCode: p.client_code,
        year: p.created_year,
      });
      await db.execute(sql`
        UPDATE projects
        SET drive_folder_id = ${tree.projectFolderId},
            drive_folder_url = ${tree.projectFolderUrl},
            updated_at = now()
        WHERE id = ${p.id}::uuid
      `);
      created.push({ id: p.id, folderId: tree.projectFolderId });
    } catch (err) {
      errors.push({
        id: p.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    report: {
      scanned: projects.length,
      created: created.length,
      errors,
      details: created,
    },
  });
}
