'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

/** The transaction handle passed into withActor's callback. */
type Tx = Parameters<Parameters<typeof withActor>[1]>[0];

/** equipment_activity_log + the company-wide activity feed (A4 brain). */
async function logEquip(
  tx: Tx,
  equipmentId: string,
  eventType: string,
  summaryAr: string,
  summaryEn: string,
  actorId: string | null,
  metadata?: Record<string, unknown>,
) {
  await tx
    .execute(
      sql`INSERT INTO equipment_activity_log (equipment_id, event_type, summary, actor_id, metadata)
          VALUES (${equipmentId}::uuid, ${eventType}, ${summaryAr}, ${actorId}::uuid,
                  ${JSON.stringify(metadata ?? {})}::jsonb)`,
    )
    .catch((e) => console.error('[logEquip]', e));
  await writeActivity({
    actorId,
    entityType: 'equipment',
    entityId: equipmentId,
    action: `equipment_${eventType}`,
    summaryAr,
    summaryEn,
    metadata,
  });
}

/** Check out a reserved item — DB fn enforces equipment.checkout + status transition. */
export async function checkoutReservation(
  equipmentId: string,
  reservationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const aid = await requirePermissionAction('equipment.checkout');
  try {
    await withActor(aid, async (tx) => {
      await tx.execute(sql`SELECT fn_checkout_equipment(${reservationId}::uuid)`);
      await logEquip(
        tx,
        equipmentId,
        'checkout',
        'تم تسليم المعدة (checkout)',
        'Equipment checked out',
        aid,
      );
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر التسليم' };
  }
  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath('/equipment');
  return { ok: true };
}

/** Return a checked-out item — DB fn handles status + damage routing. */
export async function returnReservation(
  equipmentId: string,
  reservationId: string,
  notes: string | null,
  damaged: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const aid = await requirePermissionAction('equipment.return');
  try {
    await withActor(aid, async (tx) => {
      await tx.execute(
        sql`SELECT fn_return_equipment(${reservationId}::uuid, ${notes}, ${damaged})`,
      );
      await logEquip(
        tx,
        equipmentId,
        'return',
        damaged
          ? `استُرجعت مع تلف${notes ? `: ${notes}` : ''}`
          : `استُرجعت${notes ? `: ${notes}` : ''}`,
        'Equipment returned',
        aid,
        { damaged },
      );
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر الاسترجاع' };
  }
  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath('/equipment');
  return { ok: true };
}

/** Direct status change (repair / available / lost / retired) — not checkout. */
export async function setEquipmentStatus(
  equipmentId: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!['available', 'repair', 'lost', 'retired'].includes(status)) {
    return { ok: false, error: 'حالة غير صالحة' };
  }
  // 'lost' has a dedicated permission; everything else is a generic update.
  const aid = await requirePermissionAction(
    status === 'lost' ? 'equipment.mark_lost' : 'equipment.update',
  );
  await withActor(aid, async (tx) => {
    await tx.execute(
      sql`UPDATE equipment SET status = ${status}::equipment_status, updated_at = now() WHERE id = ${equipmentId}::uuid`,
    );
    await logEquip(
      tx,
      equipmentId,
      'status',
      `تغيّرت الحالة إلى «${status}»`,
      `Status → ${status}`,
      aid,
      { status },
    );
  });
  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath('/equipment');
  return { ok: true };
}

/** Mark a chargeable item as freshly charged. */
export async function markCharged(equipmentId: string): Promise<{ ok: boolean }> {
  const aid = await requirePermissionAction('equipment.update');
  await withActor(aid, async (tx) => {
    await tx.execute(
      sql`UPDATE equipment SET last_charged_at = now(), updated_at = now() WHERE id = ${equipmentId}::uuid`,
    );
    await logEquip(tx, equipmentId, 'charged', 'تم الشحن', 'Charged', aid);
  });
  revalidatePath(`/equipment/${equipmentId}`);
  return { ok: true };
}
