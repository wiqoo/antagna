'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';

/**
 * Equipment Reservations manager — row actions.
 *
 * checkout/return go through the SECURITY DEFINER DB functions
 * (fn_checkout_equipment / fn_return_equipment). They re-check the permission
 * via current_user_has_permission(), which reads the `app.acting_as` GUC — so
 * the call MUST run inside withActor() on a single pinned connection, otherwise
 * the GUC never reaches the function (see auth-context.ts).
 *
 * cancel has no dedicated DB fn; it's a direct status flip on the reservation
 * row, gated by equipment.update.
 */

async function logEquip(
  tx: Parameters<Parameters<typeof withActor>[1]>[0],
  equipmentId: string | null,
  eventType: string,
  summaryAr: string,
  actorId: string,
) {
  if (!equipmentId) return;
  await tx
    .execute(
      sql`INSERT INTO equipment_activity_log (equipment_id, event_type, summary, actor_id)
          VALUES (${equipmentId}::uuid, ${eventType}, ${summaryAr}, ${actorId}::uuid)`,
    )
    .catch((e) => console.error('[reservations/logEquip]', e));
}

/** Check out a reserved item. DB fn enforces equipment.checkout + transition. */
export async function checkoutReservation(
  reservationId: string,
  equipmentId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const aid = await requirePermissionAction('equipment.checkout');
  try {
    await withActor(aid, async (tx) => {
      await tx.execute(sql`SELECT fn_checkout_equipment(${reservationId}::uuid)`);
      await logEquip(tx, equipmentId, 'checkout', 'تم تسليم المعدة (checkout)', aid);
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر التسليم' };
  }
  revalidatePath('/equipment/reservations');
  revalidatePath('/equipment');
  return { ok: true };
}

/** Return a checked-out item. DB fn handles status + damage routing → repair. */
export async function returnReservation(
  reservationId: string,
  equipmentId: string | null,
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
        aid,
      );
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر الاسترجاع' };
  }
  revalidatePath('/equipment/reservations');
  revalidatePath('/equipment');
  return { ok: true };
}

/** Cancel a not-yet-checked-out reservation. Gated by equipment.update. */
export async function cancelReservation(
  reservationId: string,
  equipmentId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const aid = await requirePermissionAction('equipment.update');
  try {
    await withActor(aid, async (tx) => {
      // Only a 'reserved' row can be cancelled — never an already
      // checked-out/returned one. The WHERE guard makes this idempotent + safe.
      const res = (await tx.execute<{ id: string }>(
        sql`UPDATE equipment_reservations
            SET status = 'cancelled'
            WHERE id = ${reservationId}::uuid AND status = 'reserved'
            RETURNING id`,
      )) as unknown as Array<{ id: string }>;
      if (res.length === 0) {
        throw new Error('لا يمكن إلغاء هذا الحجز (ليس بحالة محجوز).');
      }
      await logEquip(tx, equipmentId, 'reservation_cancel', 'أُلغي الحجز', aid);
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر الإلغاء' };
  }
  revalidatePath('/equipment/reservations');
  revalidatePath('/equipment');
  return { ok: true };
}
