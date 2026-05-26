/**
 * POST /api/admin/suggestions/[id]  — body { action: 'approve' | 'reject' | 'execute' | 'approve_and_execute' | 'edit', reason?, patch? }
 *
 * Gated by the `ai_suggestion.approve` permission (app-layer authz, A1) — works
 * for ANY suggestion domain (email/equipment/crm/…), not just email. Every
 * decision writes an `ai_action_log` row to seed the learning loop (A4).
 */
import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, aiSuggestions } from '@antagna/db';
import { can } from '@/lib/authz';
import { getCurrentProfile } from '@/lib/view-as';
import { executeSuggestion } from '@/lib/email-intel/execute';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ActionBody {
  action: 'approve' | 'reject' | 'execute' | 'approve_and_execute' | 'edit';
  reason?: string;
  patch?: Record<string, unknown>;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentProfile();
  if (!me || !(await can('ai_suggestion.approve'))) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  const actorId = me.id;

  const { id } = await params;
  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const [s] = await db.select().from(aiSuggestions).where(eq(aiSuggestions.id, id)).limit(1);
  if (!s) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  // Learning-loop signal: record what the human decided about this suggestion.
  const logDecision = (outcome: 'accepted' | 'rejected' | 'edited' | 'executed') =>
    db.execute(sql`
      INSERT INTO ai_action_log (feature, outcome, user_id, metadata)
      VALUES ('suggestion_review', ${outcome}, ${actorId}::uuid, ${JSON.stringify({
        suggestion_id: id,
        suggestion_type: s.suggestionType,
        source_type: s.sourceType,
        confidence: s.confidence,
        action: body.action,
      })}::jsonb)
    `);

  switch (body.action) {
    case 'approve':
      await db.update(aiSuggestions).set({
        status: 'approved', approvedById: actorId, approvedAt: new Date(), updatedAt: new Date(),
      }).where(eq(aiSuggestions.id, id));
      await logDecision('accepted');
      return NextResponse.json({ ok: true, status: 'approved' });

    case 'approve_and_execute': {
      await db.update(aiSuggestions).set({
        status: 'approved', approvedById: actorId, approvedAt: new Date(), updatedAt: new Date(),
      }).where(eq(aiSuggestions.id, id));
      const result = await executeSuggestion(id, actorId);
      await logDecision('executed');
      return NextResponse.json({ ok: result.ok, result });
    }

    case 'execute': {
      const result = await executeSuggestion(id, actorId);
      await logDecision('executed');
      return NextResponse.json({ ok: result.ok, result });
    }

    case 'reject':
      await db.update(aiSuggestions).set({
        status: 'rejected', rejectedReason: body.reason ?? null, approvedById: actorId, updatedAt: new Date(),
      }).where(eq(aiSuggestions.id, id));
      await logDecision('rejected');
      return NextResponse.json({ ok: true, status: 'rejected' });

    case 'edit': {
      const merged = { ...(s.proposedData as Record<string, unknown>), ...(body.patch ?? {}) };
      await db.update(aiSuggestions).set({ proposedData: merged, updatedAt: new Date() }).where(eq(aiSuggestions.id, id));
      await logDecision('edited');
      return NextResponse.json({ ok: true, status: 'edited', proposedData: merged });
    }

    default:
      return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 });
  }
}
