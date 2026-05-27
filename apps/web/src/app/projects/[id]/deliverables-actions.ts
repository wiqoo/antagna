'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { writeActivity } from '@/lib/activity';

async function actor() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [a] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (a) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${a.id}, true)`);
  }
  return a?.id ?? null;
}

export async function addDeliverableGroup(projectId: string, formData: FormData) {
  await actor();
  const nameAr = formData.get('nameAr')?.toString().trim();
  const nameEn = formData.get('nameEn')?.toString().trim() || null;
  const kind = formData.get('kind')?.toString() || null;
  if (!nameAr) return;

  await db.execute(sql`
    INSERT INTO deliverable_groups (project_id, name_ar, name_en, kind)
    VALUES (${projectId}::uuid, ${nameAr}, ${nameEn}, ${kind})
  `);

  revalidatePath(`/projects/${projectId}`);
}

export async function addDeliverable(projectId: string, formData: FormData) {
  const actorId = await actor();
  const groupId = formData.get('groupId')?.toString();
  const title = formData.get('title')?.toString().trim() || null;
  const itemNumber = formData.get('itemNumber')?.toString().trim() || null;
  if (!groupId) return;

  await db.execute(sql`
    INSERT INTO deliverables (group_id, project_id, title, item_number, status)
    VALUES (${groupId}::uuid, ${projectId}::uuid, ${title}, ${itemNumber}, 'draft'::deliverable_status)
  `);

  await writeActivity({
    actorId,
    entityType: 'project',
    entityId: projectId,
    projectId,
    action: 'deliverable_added',
    summaryAr: `مخرَج جديد: ${title ?? itemNumber ?? 'بدون عنوان'}`,
    summaryEn: `Deliverable added: ${title ?? itemNumber ?? 'untitled'}`,
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function setDeliverableStatus(
  projectId: string,
  deliverableId: string,
  nextStatus: string,
) {
  const actorId = await actor();
  const valid = [
    'draft', 'submitted', 'pending_director', 'pending_am',
    'revisions_director', 'revisions_am', 'client_ready',
    'in_client_review', 'revisions_client', 'delivered', 'cancelled',
  ];
  if (!valid.includes(nextStatus)) return;

  const setApproved = nextStatus === 'delivered'
    ? sql`, approved_at = now()`
    : sql``;

  await db.execute(sql`
    UPDATE deliverables
    SET status = ${nextStatus}::deliverable_status,
        updated_at = now()
        ${setApproved}
    WHERE id = ${deliverableId}::uuid
  `);

  await writeActivity({
    actorId,
    entityType: 'deliverable',
    entityId: deliverableId,
    projectId,
    action: 'deliverable_status',
    summaryAr: `تغيّرت حالة المخرَج إلى «${nextStatus}»`,
    summaryEn: `Deliverable status → ${nextStatus}`,
    metadata: { status: nextStatus },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteDeliverable(projectId: string, deliverableId: string) {
  await actor();
  await db.execute(sql`
    DELETE FROM deliverables WHERE id = ${deliverableId}::uuid
  `);
  revalidatePath(`/projects/${projectId}`);
}

export async function addReservation(projectId: string, formData: FormData) {
  const actorId = await actor();

  const equipmentId = formData.get('equipmentId')?.toString() || null;
  const groupId = formData.get('groupId')?.toString() || null;
  const startsAt = formData.get('startsAt')?.toString();
  const endsAt = formData.get('endsAt')?.toString();
  const notes = formData.get('notes')?.toString().trim() || null;

  if ((!equipmentId && !groupId) || !startsAt || !endsAt) return;

  try {
    await db.execute(sql`
      INSERT INTO equipment_reservations
        (equipment_id, group_id, project_id, starts_at, ends_at,
         reserved_by_id, status, notes)
      VALUES (
        ${equipmentId ? sql`${equipmentId}::uuid` : sql`NULL`},
        ${groupId ? sql`${groupId}::uuid` : sql`NULL`},
        ${projectId}::uuid,
        ${startsAt}::timestamptz,
        ${endsAt}::timestamptz,
        ${actorId ? sql`${actorId}::uuid` : sql`NULL`},
        'reserved',
        ${notes}
      )
    `);
  } catch (err) {
    // Likely an overlap from the btree_gist exclusion constraint.
    console.error('reservation failed', err);
    throw new Error('فشل الحجز — قد يكون فيه تعارض زمني مع حجز آخر.');
  }

  await writeActivity({
    actorId,
    entityType: 'project',
    entityId: projectId,
    projectId,
    action: 'equipment_reserved',
    summaryAr: 'حُجزت معدات للمشروع',
    summaryEn: 'Equipment reserved for the project',
    metadata: { equipment_id: equipmentId, group_id: groupId },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/equipment');
}
