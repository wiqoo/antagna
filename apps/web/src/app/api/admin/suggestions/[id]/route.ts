/**
 * POST /api/admin/suggestions/[id]  — action body { action: 'approve' | 'reject' | 'execute' | 'edit', reason?, patch? }
 *
 * approve  → status='approved', approved_by, approved_at = now()
 * execute  → run executeSuggestion(), status flips to executed/failed
 * reject   → status='rejected', rejected_reason
 * edit     → merge `patch` into proposed_data (admin editing before approve)
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, aiSuggestions } from '@antagna/db';
import { getAdminUser } from '@/lib/auth-admin';
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
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;
  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const [s] = await db
    .select()
    .from(aiSuggestions)
    .where(eq(aiSuggestions.id, id))
    .limit(1);
  if (!s) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  switch (body.action) {
    case 'approve':
      await db
        .update(aiSuggestions)
        .set({
          status: 'approved',
          approvedById: admin.profile.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiSuggestions.id, id));
      return NextResponse.json({ ok: true, status: 'approved' });

    case 'approve_and_execute': {
      await db
        .update(aiSuggestions)
        .set({
          status: 'approved',
          approvedById: admin.profile.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiSuggestions.id, id));
      const result = await executeSuggestion(id, admin.profile.id);
      return NextResponse.json({ ok: result.ok, result });
    }

    case 'execute': {
      const result = await executeSuggestion(id, admin.profile.id);
      return NextResponse.json({ ok: result.ok, result });
    }

    case 'reject':
      await db
        .update(aiSuggestions)
        .set({
          status: 'rejected',
          rejectedReason: body.reason ?? null,
          approvedById: admin.profile.id,
          updatedAt: new Date(),
        })
        .where(eq(aiSuggestions.id, id));
      return NextResponse.json({ ok: true, status: 'rejected' });

    case 'edit': {
      const merged = {
        ...(s.proposedData as Record<string, unknown>),
        ...(body.patch ?? {}),
      };
      await db
        .update(aiSuggestions)
        .set({ proposedData: merged, updatedAt: new Date() })
        .where(eq(aiSuggestions.id, id));
      return NextResponse.json({ ok: true, status: 'edited', proposedData: merged });
    }

    default:
      return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 });
  }
}
