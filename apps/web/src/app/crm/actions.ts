'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

const LEAD_STATUSES = [
  'new',
  'qualified',
  'nurturing',
  'proposal_sent',
  'won',
  'lost',
  'ghosted',
];

const LEAD_STATUS_AR: Record<string, string> = {
  new: 'جديد',
  qualified: 'مؤهّل',
  nurturing: 'رعاية',
  proposal_sent: 'عرض مُرسَل',
  won: 'مكسوب',
  lost: 'مفقود',
  ghosted: 'متجاهَل',
};

/** Move a lead through the funnel. Writes activity so the brain + timeline see it. */
export async function updateLeadStatus(
  leadId: string,
  nextStatus: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!LEAD_STATUSES.includes(nextStatus)) return { ok: false, error: 'invalid status' };
  // Authz (audit fix): gate on client.update (no lead-specific key) + run the
  // mutation inside withActor so app.acting_as reaches the audit trigger.
  const aid = await requirePermissionAction('client.update');

  await withActor(aid, (tx) =>
    tx.execute(sql`
      UPDATE leads SET status = ${nextStatus}::lead_status, updated_at = now()
      WHERE id = ${leadId}::uuid
    `),
  );

  await writeActivity({
    actorId: aid,
    entityType: 'lead',
    entityId: leadId,
    action: 'lead_status',
    summaryAr: `تغيّرت حالة الفرصة إلى «${LEAD_STATUS_AR[nextStatus] ?? nextStatus}»`,
    summaryEn: `Lead status → ${nextStatus}`,
    metadata: { status: nextStatus },
  });

  revalidatePath('/crm');
  return { ok: true };
}
