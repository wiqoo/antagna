'use server';

import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const STATUSES = ['available', 'busy', 'tentative'];

/** Add an availability window for a freelancer. */
export async function addFreelancerAvailability(
  freelancerId: string,
  formData: FormData,
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  const startsAt = formData.get('startsAt')?.toString();
  const endsAt = formData.get('endsAt')?.toString();
  const status = formData.get('status')?.toString() || 'available';
  const note = formData.get('note')?.toString().trim() || null;
  if (!startsAt || !endsAt || !STATUSES.includes(status)) return;

  await db.execute(sql`
    INSERT INTO freelancer_availability (freelancer_id, starts_at, ends_at, status, note, created_by)
    VALUES (
      ${freelancerId}::uuid, ${startsAt}::timestamptz, ${endsAt}::timestamptz,
      ${status}, ${note}, ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
    )
  `);
  revalidatePath(`/freelancers/${freelancerId}`);
}

export async function removeFreelancerAvailability(
  freelancerId: string,
  rowId: string,
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await db.execute(sql`DELETE FROM freelancer_availability WHERE id = ${rowId}::uuid`);
  revalidatePath(`/freelancers/${freelancerId}`);
}
