import { NextResponse } from 'next/server';
import { db, decisionOutcomes } from '@antagna/db';
import { eq } from 'drizzle-orm';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [row] = await db
    .select()
    .from(decisionOutcomes)
    .where(eq(decisionOutcomes.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, decision: row });
}
