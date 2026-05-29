'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';
import { parseStr, parseNum, parseDate } from '@/lib/parse';

/** The transaction handle passed into withActor's callback. */
type Tx = Parameters<Parameters<typeof withActor>[1]>[0];

const SEVERITIES = ['minor', 'major', 'unusable'] as const;
const STATUSES = ['reported', 'in_progress', 'fixed'] as const;
type Severity = (typeof SEVERITIES)[number];
type Status = (typeof STATUSES)[number];

/** equipment_activity_log + the company-wide activity feed (A4 brain). Best-effort. */
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
    .catch((e) => console.error('[repairs/logEquip]', e));
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

/**
 * Open a repair ticket on an equipment unit. Also flips the unit's catalog
 * status to 'repair' so it stops showing as bookable. Gated equipment.update.
 */
export async function createRepair(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const aid = await requirePermissionAction('equipment.update');

  const equipmentId = parseStr(formData.get('equipmentId'));
  const issueDescription = parseStr(formData.get('issueDescription'));
  const severityRaw = parseStr(formData.get('severity')) ?? 'minor';
  const severity: Severity = (SEVERITIES as readonly string[]).includes(severityRaw)
    ? (severityRaw as Severity)
    : 'minor';
  const vendor = parseStr(formData.get('vendor')); // "fixer" — workshop / technician
  const eta = parseDate(formData.get('eta')); // expected return date → returned_at planning
  const notes = parseStr(formData.get('notes'));

  if (!equipmentId) return { ok: false, error: 'لم تُحدَّد المعدة.' };
  if (!issueDescription) return { ok: false, error: 'وصف العطل مطلوب.' };

  try {
    await withActor(aid, async (tx) => {
      await tx.execute(sql`
        INSERT INTO equipment_repairs
          (equipment_id, reported_by_id, issue_description, severity, vendor, returned_at, status, notes)
        VALUES (
          ${equipmentId}::uuid, ${aid}::uuid, ${issueDescription}, ${severity},
          ${vendor}, ${eta ? sql`${eta}::timestamptz` : sql`NULL`}, 'reported', ${notes}
        )
      `);
      // Take the unit out of the bookable pool while it is in for repair.
      await tx.execute(sql`
        UPDATE equipment SET status = 'repair'::equipment_status, updated_at = now()
        WHERE id = ${equipmentId}::uuid AND status <> 'retired'::equipment_status
      `);
      await logEquip(
        tx,
        equipmentId,
        'repair_reported',
        `بلاغ عطل (${severity}): ${issueDescription.slice(0, 80)}`,
        `Repair reported (${severity})`,
        aid,
        { severity, vendor, eta },
      );
    });
  } catch (e) {
    console.error('[createRepair]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر فتح البلاغ.' };
  }

  revalidatePath('/equipment/repairs');
  revalidatePath('/equipment');
  revalidatePath(`/equipment/${equipmentId}`);
  return { ok: true };
}

/**
 * Move a repair forward in its lifecycle: reported → in_progress → fixed.
 * 'in_progress' stamps sent_at; 'fixed' stamps returned_at and (if no other
 * open repair on that unit) returns the equipment to 'available'.
 */
export async function setRepairStatus(
  repairId: string,
  equipmentId: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: 'حالة غير صالحة.' };
  }
  const next = status as Status;
  const aid = await requirePermissionAction('equipment.update');

  try {
    await withActor(aid, async (tx) => {
      if (next === 'in_progress') {
        await tx.execute(sql`
          UPDATE equipment_repairs
          SET status = 'in_progress', sent_at = COALESCE(sent_at, now())
          WHERE id = ${repairId}::uuid
        `);
      } else if (next === 'fixed') {
        await tx.execute(sql`
          UPDATE equipment_repairs
          SET status = 'fixed', returned_at = now()
          WHERE id = ${repairId}::uuid
        `);
      } else {
        await tx.execute(sql`
          UPDATE equipment_repairs SET status = 'reported' WHERE id = ${repairId}::uuid
        `);
      }

      if (next === 'fixed') {
        // Only free the unit if nothing else still has it open.
        await tx.execute(sql`
          UPDATE equipment SET status = 'available'::equipment_status, updated_at = now()
          WHERE id = ${equipmentId}::uuid
            AND status = 'repair'::equipment_status
            AND NOT EXISTS (
              SELECT 1 FROM equipment_repairs r
              WHERE r.equipment_id = ${equipmentId}::uuid
                AND r.status <> 'fixed'
            )
        `);
      }

      await logEquip(
        tx,
        equipmentId,
        next === 'fixed' ? 'repair_fixed' : 'repair_status',
        next === 'fixed'
          ? 'اكتمل الإصلاح وعادت المعدة للتوفّر'
          : `حالة الإصلاح → ${next}`,
        next === 'fixed' ? 'Repair fixed' : `Repair status → ${next}`,
        aid,
        { status: next },
      );
    });
  } catch (e) {
    console.error('[setRepairStatus]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر تحديث الحالة.' };
  }

  revalidatePath('/equipment/repairs');
  revalidatePath('/equipment');
  revalidatePath(`/equipment/${equipmentId}`);
  return { ok: true };
}

/** Update the expected-return ETA (and optionally vendor + cost) on an open repair. */
export async function updateRepairEta(
  repairId: string,
  equipmentId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const aid = await requirePermissionAction('equipment.update');

  const eta = parseDate(formData.get('eta'));
  const vendor = parseStr(formData.get('vendor'));
  const costSar = parseNum(formData.get('costSar'));

  try {
    await withActor(aid, async (tx) => {
      await tx.execute(sql`
        UPDATE equipment_repairs
        SET returned_at = ${eta ? sql`${eta}::timestamptz` : sql`NULL`},
            vendor = ${vendor},
            cost_sar = ${costSar != null ? sql`${costSar}::numeric` : sql`cost_sar`}
        WHERE id = ${repairId}::uuid
      `);
      await logEquip(
        tx,
        equipmentId,
        'repair_eta',
        `حُدِّث موعد/جهة الإصلاح${eta ? ` (ETA ${eta.slice(0, 10)})` : ''}`,
        'Repair ETA updated',
        aid,
        { eta, vendor, costSar },
      );
    });
  } catch (e) {
    console.error('[updateRepairEta]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر التحديث.' };
  }

  revalidatePath('/equipment/repairs');
  revalidatePath(`/equipment/${equipmentId}`);
  return { ok: true };
}
