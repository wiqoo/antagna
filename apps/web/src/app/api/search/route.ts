import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Row = {
  type: 'project' | 'client' | 'profile' | 'equipment';
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
};

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ results: [] }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const like = `%${q}%`;

  const rows = (await db.execute<Row>(sql`
    (
      SELECT
        'project'::text AS type,
        id::text AS id,
        title AS label,
        code || (CASE WHEN title_ar IS NOT NULL THEN ' · ' || title_ar ELSE '' END) AS sublabel,
        '/projects/' || id::text AS href
      FROM projects
      WHERE archived_at IS NULL
        AND (title ILIKE ${like} OR title_ar ILIKE ${like} OR code ILIKE ${like})
      ORDER BY updated_at DESC
      LIMIT 8
    )
    UNION ALL
    (
      SELECT
        'client'::text AS type,
        id::text AS id,
        name_ar AS label,
        code || (CASE WHEN name_en IS NOT NULL THEN ' · ' || name_en ELSE '' END) AS sublabel,
        '/clients/' || id::text AS href
      FROM clients
      WHERE archived_at IS NULL
        AND (name_ar ILIKE ${like} OR name_en ILIKE ${like} OR code ILIKE ${like})
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 8
    )
    UNION ALL
    (
      SELECT
        'profile'::text AS type,
        id::text AS id,
        display_name AS label,
        email AS sublabel,
        '/admin'::text AS href
      FROM profiles
      WHERE status = 'active'
        AND (display_name ILIKE ${like} OR email ILIKE ${like})
      LIMIT 8
    )
    UNION ALL
    (
      SELECT
        'equipment'::text AS type,
        id::text AS id,
        (manufacturer || ' ' || model) AS label,
        code || ' · ' || category AS sublabel,
        '/equipment'::text AS href
      FROM equipment
      WHERE archived_at IS NULL
        AND (model ILIKE ${like} OR code ILIKE ${like} OR manufacturer ILIKE ${like} OR category ILIKE ${like})
      LIMIT 8
    )
  `)) as unknown as Row[];

  return NextResponse.json({ results: rows });
}
