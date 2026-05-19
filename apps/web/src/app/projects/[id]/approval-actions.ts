'use server';

import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

async function actor() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
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

/**
 * Pillar 16 §N approval pipeline.
 * Creator → Director → AM → Client.
 *
 * submitForReview: creator → director (or AM if director not required)
 * approve: director → AM, or AM → client_ready
 * requestRevisions: anywhere → revisions_*
 */
export async function submitForReview(projectId: string, deliverableId: string) {
  await actor();
  // Read current project's approval flow + deliverable
  const res = await db.execute<{
    requires_director: boolean;
    requires_am: boolean;
  }>(sql`
    SELECT requires_director_approval AS requires_director,
           requires_am_approval AS requires_am
    FROM deliverables
    WHERE id = ${deliverableId}::uuid
  `);
  const row = (res as unknown as Array<{
    requires_director: boolean;
    requires_am: boolean;
  }>)[0];
  if (!row) return;

  const nextStatus = row.requires_director
    ? 'pending_director'
    : row.requires_am
      ? 'pending_am'
      : 'client_ready';

  await db.execute(sql`
    UPDATE deliverables
    SET status = ${nextStatus}::deliverable_status,
        submitted_at = COALESCE(submitted_at, now()),
        current_approval_stage = ${nextStatus},
        updated_at = now()
    WHERE id = ${deliverableId}::uuid
  `);

  revalidatePath(`/projects/${projectId}`);
}

export async function approveDeliverable(
  projectId: string,
  deliverableId: string,
) {
  const actorId = await actor();
  // Move forward in pipeline.
  const res = await db.execute<{
    status: string;
    requires_am: boolean;
  }>(sql`
    SELECT status::text AS status, requires_am_approval AS requires_am
    FROM deliverables
    WHERE id = ${deliverableId}::uuid
  `);
  const row = (res as unknown as Array<{
    status: string;
    requires_am: boolean;
  }>)[0];
  if (!row) return;

  let nextStatus: string;
  switch (row.status) {
    case 'pending_director':
      nextStatus = row.requires_am ? 'pending_am' : 'client_ready';
      break;
    case 'pending_am':
      nextStatus = 'client_ready';
      break;
    case 'client_ready':
    case 'in_client_review':
      nextStatus = 'delivered';
      break;
    default:
      // Skip-ahead approve from draft / revisions states
      nextStatus = 'client_ready';
  }

  await db.execute(sql`
    UPDATE deliverables
    SET status = ${nextStatus}::deliverable_status,
        approved_at = CASE WHEN ${nextStatus} = 'delivered' THEN now() ELSE approved_at END,
        approved_by_id = CASE WHEN ${nextStatus} = 'delivered' THEN ${actorId}::uuid ELSE approved_by_id END,
        current_approval_stage = ${nextStatus},
        updated_at = now()
    WHERE id = ${deliverableId}::uuid
  `);

  revalidatePath(`/projects/${projectId}`);
}

export async function requestRevisions(
  projectId: string,
  deliverableId: string,
  formData: FormData,
) {
  await actor();
  const note = formData.get('note')?.toString().trim() || null;
  const stage = formData.get('stage')?.toString();

  let newStatus: string;
  switch (stage) {
    case 'director':
      newStatus = 'revisions_director';
      break;
    case 'am':
      newStatus = 'revisions_am';
      break;
    case 'client':
      newStatus = 'revisions_client';
      break;
    default:
      newStatus = 'revisions_director';
  }

  await db.execute(sql`
    UPDATE deliverables
    SET status = ${newStatus}::deliverable_status,
        latest_client_note = ${note},
        latest_client_note_at = now(),
        current_cycle = current_cycle + 1,
        updated_at = now()
    WHERE id = ${deliverableId}::uuid
  `);

  revalidatePath(`/projects/${projectId}`);
}
