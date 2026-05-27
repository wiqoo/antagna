'use server';

import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { writeActivity } from '@/lib/activity';

async function actor(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [a] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (a) await db.execute(sql`SELECT set_config('app.acting_as', ${a.id}, true)`);
  return a?.id ?? null;
}

/** equipment_activity_log + the company-wide activity feed (A4 brain). */
async function logEquip(
  equipmentId: string,
  eventType: string,
  summaryAr: string,
  summaryEn: string,
  actorId: string | null,
  metadata?: Record<string, unknown>,
) {
  await db
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
  const aid = await actor();
  try {
    await db.execute(sql`SELECT fn_checkout_equipment(${reservationId}::uuid)`);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر التسليم' };
  }
  await logEquip(equipmentId, 'checkout', 'تم تسليم المعدة (checkout)', 'Equipment checked out', aid);
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
  const aid = await actor();
  try {
    await db.execute(
      sql`SELECT fn_return_equipment(${reservationId}::uuid, ${notes}, ${damaged})`,
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر الاسترجاع' };
  }
  await logEquip(
    equipmentId,
    'return',
    damaged ? `استُرجعت مع تلف${notes ? `: ${notes}` : ''}` : `استُرجعت${notes ? `: ${notes}` : ''}`,
    'Equipment returned',
    aid,
    { damaged },
  );
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
  const aid = await actor();
  await db.execute(
    sql`UPDATE equipment SET status = ${status}::equipment_status, updated_at = now() WHERE id = ${equipmentId}::uuid`,
  );
  await logEquip(equipmentId, 'status', `تغيّرت الحالة إلى «${status}»`, `Status → ${status}`, aid, {
    status,
  });
  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath('/equipment');
  return { ok: true };
}

/** Mark a chargeable item as freshly charged. */
export async function markCharged(equipmentId: string): Promise<{ ok: boolean }> {
  const aid = await actor();
  await db.execute(
    sql`UPDATE equipment SET last_charged_at = now(), updated_at = now() WHERE id = ${equipmentId}::uuid`,
  );
  await logEquip(equipmentId, 'charged', 'تم الشحن', 'Charged', aid);
  revalidatePath(`/equipment/${equipmentId}`);
  return { ok: true };
}
