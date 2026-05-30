'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';

const STATUSES = ['available', 'busy', 'tentative'];

/** Add an availability window for a freelancer. */
export async function addFreelancerAvailability(
  freelancerId: string,
  formData: FormData,
): Promise<void> {
  const actorId = await requirePermissionAction('access.manage');

  const startsAt = formData.get('startsAt')?.toString();
  const endsAt = formData.get('endsAt')?.toString();
  const status = formData.get('status')?.toString() || 'available';
  const note = formData.get('note')?.toString().trim() || null;
  if (!startsAt || !endsAt || !STATUSES.includes(status)) return;

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      INSERT INTO freelancer_availability (freelancer_id, starts_at, ends_at, status, note, created_by)
      VALUES (
        ${freelancerId}::uuid, ${startsAt}::timestamptz, ${endsAt}::timestamptz,
        ${status}, ${note}, ${actorId}::uuid
      )
    `),
  );
  revalidatePath(`/freelancers/${freelancerId}`);
}

export async function removeFreelancerAvailability(
  freelancerId: string,
  rowId: string,
): Promise<void> {
  const actorId = await requirePermissionAction('access.manage');
  await withActor(actorId, (tx) =>
    tx.execute(sql`DELETE FROM freelancer_availability WHERE id = ${rowId}::uuid`),
  );
  revalidatePath(`/freelancers/${freelancerId}`);
}
