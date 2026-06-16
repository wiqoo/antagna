'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requirePartner } from './auth';
import { notifyVersionSubmitted, notifyFinalDelivered } from './notify';

const s = (v: FormDataEntryValue | null, max = 1000): string =>
  (v == null ? '' : String(v)).trim().slice(0, max);

/** Partner edits their own profile (name + contact). */
export async function updateMyProfile(formData: FormData): Promise<void> {
  const me = await requirePartner();
  const name = s(formData.get('name'), 120);
  const email = s(formData.get('contact_email'), 160);
  const phone = s(formData.get('contact_phone'), 40);
  await db.execute(sql`UPDATE ext_users SET display_name = ${name || null} WHERE auth_user_id = ${me.authUserId}::uuid`);
  await db.execute(sql`
    UPDATE partners SET contact_email = ${email || null}, contact_phone = ${phone || null}, updated_at = now()
    WHERE id = ${me.partnerId}::uuid
  `);
  revalidatePath('/outsource/portal');
}

/** Verify the logged-in partner actually owns this job. Returns partnerId. */
async function ownJob(jobId: string): Promise<string> {
  const me = await requirePartner();
  const rows = (await db.execute(sql`
    SELECT 1 FROM external_jobs WHERE id = ${jobId}::uuid AND partner_id = ${me.partnerId}::uuid
  `)) as unknown as unknown[];
  if (rows.length === 0) throw new Error('forbidden');
  return me.partnerId;
}

/** Partner submits their version link for a revision round. */
export async function portalSubmitVersion(jobId: string, revisionId: string, formData: FormData): Promise<void> {
  await ownJob(jobId);
  const url = s(formData.get('version_url'), 1000);
  if (!url) return;
  await db.execute(sql`
    UPDATE external_job_revisions SET version_url = ${url}, status = 'submitted'
    WHERE id = ${revisionId}::uuid AND job_id = ${jobId}::uuid
  `);
  notifyVersionSubmitted(jobId).catch(() => {});
  revalidatePath(`/outsource/portal/${jobId}`);
}

/** Partner links the uploaded final (attachment created via /api/upload). */
export async function portalSetFinal(jobId: string, attachmentId: string): Promise<void> {
  await ownJob(jobId);
  await db.execute(sql`
    UPDATE external_jobs
    SET final_attachment_id = ${attachmentId}::uuid, status = 'delivered', delivered_at = now(), updated_at = now()
    WHERE id = ${jobId}::uuid
  `);
  notifyFinalDelivered(jobId).catch(() => {});
  revalidatePath(`/outsource/portal/${jobId}`);
}
