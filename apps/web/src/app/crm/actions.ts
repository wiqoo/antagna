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

/**
 * Link an end-client (brand) under an agency via agency_brand_links (M:N) — the
 * agency is our direct client, the brand sits under it. Flags the agency side
 * is_agency=true and is idempotent. The inverse is unlinkBrandFromAgency.
 */
export async function linkBrandToAgency(
  brandId: string,
  agencyId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!brandId || !agencyId || brandId === agencyId) {
    return { ok: false, error: 'اختيار غير صالح' };
  }
  const actorId = await requirePermissionAction('client.update');
  await withActor(actorId, async (tx) => {
    await tx.execute(sql`
      UPDATE clients SET is_agency = true, updated_at = now() WHERE id = ${agencyId}::uuid
    `);
    await tx.execute(sql`
      INSERT INTO agency_brand_links (agency_id, brand_id)
      VALUES (${agencyId}::uuid, ${brandId}::uuid)
      ON CONFLICT (agency_id, brand_id) DO NOTHING
    `);
  });
  await writeActivity({
    actorId,
    entityType: 'client',
    entityId: brandId,
    action: 'brand_linked_agency',
    summaryAr: 'رُبط العميل النهائي بوكالة',
    summaryEn: 'Brand linked under agency',
    metadata: { agency_id: agencyId },
  });
  revalidatePath('/crm');
  revalidatePath(`/clients/${brandId}`);
  revalidatePath(`/clients/${agencyId}`);
  return { ok: true };
}

export async function unlinkBrandFromAgency(
  brandId: string,
  agencyId: string,
): Promise<{ ok: boolean }> {
  const actorId = await requirePermissionAction('client.update');
  await withActor(actorId, (tx) =>
    tx.execute(sql`
      DELETE FROM agency_brand_links
      WHERE agency_id = ${agencyId}::uuid AND brand_id = ${brandId}::uuid
    `),
  );
  revalidatePath('/crm');
  revalidatePath(`/clients/${brandId}`);
  revalidatePath(`/clients/${agencyId}`);
  return { ok: true };
}

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
