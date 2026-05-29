'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';

const VALID_STATUS = new Set(['open', 'in_review', 'resolved', 'dismissed']);

/**
 * Triage a feedback item — move it through open → in_review → resolved /
 * dismissed. Gated on `access.manage`; audit actor pinned via withActor so the
 * mutation + GUC ride the same pooled connection.
 */
export async function setFeedbackStatus(formData: FormData) {
  const actor = await requirePermissionAction('access.manage');

  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id || !VALID_STATUS.has(status)) return;

  await withActor(actor, (tx) =>
    tx.execute(sql`
      UPDATE feedback SET status = ${status} WHERE id = ${id}::uuid
    `),
  );

  revalidatePath('/admin/feedback');
}
