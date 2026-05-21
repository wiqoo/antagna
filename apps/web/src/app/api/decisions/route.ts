import { NextResponse } from 'next/server';
import { db, decisionOutcomes, projectLearnings } from '@antagna/db';
import { sql, desc, eq, and, gte, lte, isNotNull, isNull } from 'drizzle-orm';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/decisions — paginated list of recorded AI / human decisions
 * with their outcomes. Filters:
 *   ?type=lead_qualification          decision_type
 *   ?outcome=success|failure|pending  status filter
 *   ?since=YYYY-MM-DD                 decision_made_at >= date
 *   ?until=YYYY-MM-DD                 decision_made_at <= date
 *   ?limit=50 (default 50, max 200)
 *   ?cursor=<iso-ts>                  for pagination on decision_made_at
 *   ?withLearnings=1                  include the related learnings rows
 */
export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const outcome = url.searchParams.get('outcome');
  const since = url.searchParams.get('since');
  const until = url.searchParams.get('until');
  const cursor = url.searchParams.get('cursor');
  const withLearnings = url.searchParams.get('withLearnings') === '1';
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50),
  );

  const conditions = [];
  if (type) conditions.push(eq(decisionOutcomes.decisionType, type));
  if (since)
    conditions.push(gte(decisionOutcomes.decisionMadeAt, new Date(since)));
  if (until)
    conditions.push(lte(decisionOutcomes.decisionMadeAt, new Date(until)));
  if (cursor)
    conditions.push(lte(decisionOutcomes.decisionMadeAt, new Date(cursor)));

  if (outcome === 'pending') {
    conditions.push(isNull(decisionOutcomes.outcomeMeasuredAt));
  } else if (outcome) {
    conditions.push(isNotNull(decisionOutcomes.outcomeMeasuredAt));
    conditions.push(eq(decisionOutcomes.outcomeLabel, outcome));
  }

  const rows = await db
    .select()
    .from(decisionOutcomes)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(decisionOutcomes.decisionMadeAt))
    .limit(limit);

  let learnings: { decisionId: string; learnings: typeof projectLearnings.$inferSelect[] }[] = [];
  if (withLearnings && rows.length > 0) {
    // We don't have a direct decision↔learning FK; we look up learnings by
    // their decision_outcomes id appearing in derived_from_activity_event_ids
    // would be wrong (those are bigints). Instead use scope='project' +
    // scope_id when the decision_output carries one.
    const projectIds = Array.from(
      new Set(
        rows
          .map((r) => {
            const out = r.decisionOutput as { project_id?: string } | null;
            return out?.project_id;
          })
          .filter((v): v is string => !!v),
      ),
    );
    if (projectIds.length > 0) {
      const learningRows = await db
        .select()
        .from(projectLearnings)
        .where(
          and(
            eq(projectLearnings.scope, 'project'),
            sql`${projectLearnings.scopeId} = ANY(${projectIds}::uuid[])`,
            eq(projectLearnings.active, true),
          ),
        );
      learnings = projectIds.map((pid) => ({
        decisionId: pid,
        learnings: learningRows.filter((l) => l.scopeId === pid),
      }));
    }
  }

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last
      ? new Date(last.decisionMadeAt).toISOString()
      : null;

  return NextResponse.json({
    ok: true,
    decisions: rows,
    nextCursor,
    learnings: withLearnings ? learnings : undefined,
  });
}
