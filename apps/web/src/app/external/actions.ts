'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getEffectiveProfileId } from '@/lib/authz';

async function actor(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');
  try {
    return await getEffectiveProfileId();
  } catch {
    return null;
  }
}

const str = (v: FormDataEntryValue | null, max = 4000): string | null => {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, max) : null;
};
const num = (v: FormDataEntryValue | null): number | null => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// ── partners ─────────────────────────────────────────────────────────────────
export async function createPartner(formData: FormData): Promise<void> {
  await actor();
  const name = str(formData.get('name'), 120);
  if (!name) return;
  const kind = String(formData.get('kind') ?? 'company') === 'individual' ? 'individual' : 'company';
  const specialties = formData.getAll('specialties').map((s) => String(s)).filter(Boolean);
  await db.execute(sql`
    INSERT INTO partners (code, name, name_ar, kind, specialties, contact_name, contact_email, contact_phone, notes)
    VALUES (
      ${'P-' + Math.random().toString(36).slice(2, 7).toUpperCase()},
      ${name}, ${str(formData.get('name_ar'), 120)}, ${kind},
      ${sql`ARRAY[${sql.join(specialties.map((s) => sql`${s}`), sql`, `)}]::text[]`},
      ${str(formData.get('contact_name'), 120)}, ${str(formData.get('contact_email'), 160)},
      ${str(formData.get('contact_phone'), 40)}, ${str(formData.get('notes'))}
    )
  `);
  revalidatePath('/external/partners');
  revalidatePath('/external');
  redirect('/external/partners');
}

// ── jobs ─────────────────────────────────────────────────────────────────────
export async function createJob(formData: FormData): Promise<void> {
  const pid = await actor();
  const title = str(formData.get('title'), 160);
  if (!title) return;
  const partnerId = str(formData.get('partner_id'), 40);
  const finalDue = str(formData.get('final_due_at'), 30);
  const agreed = num(formData.get('agreed_amount_sar'));
  const rows = (await db.execute<{ id: string }>(sql`
    INSERT INTO external_jobs (title, partner_id, scope, brief, final_due_at, agreed_amount_sar, created_by)
    VALUES (
      ${title},
      ${partnerId ? sql`${partnerId}::uuid` : sql`NULL`},
      ${str(formData.get('scope'))}, ${str(formData.get('brief'))},
      ${finalDue ? sql`${finalDue}::timestamptz` : sql`NULL`},
      ${agreed != null ? sql`${agreed}::numeric` : sql`NULL`},
      ${pid ? sql`${pid}::uuid` : sql`NULL`}
    )
    RETURNING id::text AS id
  `)) as unknown as Array<{ id: string }>;
  const id = rows[0]?.id;
  revalidatePath('/external');
  if (id) redirect(`/external/${id}`);
  redirect('/external');
}

export async function updateJob(jobId: string, formData: FormData): Promise<void> {
  await actor();
  const partnerId = str(formData.get('partner_id'), 40);
  const finalDue = str(formData.get('final_due_at'), 30);
  const agreed = num(formData.get('agreed_amount_sar'));
  await db.execute(sql`
    UPDATE external_jobs SET
      title = COALESCE(${str(formData.get('title'), 160)}, title),
      scope = ${str(formData.get('scope'))},
      brief = ${str(formData.get('brief'))},
      partner_id = ${partnerId ? sql`${partnerId}::uuid` : sql`NULL`},
      final_due_at = ${finalDue ? sql`${finalDue}::timestamptz` : sql`NULL`},
      agreed_amount_sar = ${agreed != null ? sql`${agreed}::numeric` : sql`NULL`},
      updated_at = now()
    WHERE id = ${jobId}::uuid
  `);
  revalidatePath(`/external/${jobId}`);
  revalidatePath('/external');
}

export async function setJobStatus(jobId: string, status: string): Promise<void> {
  await actor();
  const allowed = ['draft', 'in_progress', 'review', 'revisions', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) return;
  await db.execute(sql`
    UPDATE external_jobs
    SET status = ${status},
        delivered_at = ${status === 'delivered' ? sql`now()` : sql`delivered_at`},
        updated_at = now()
    WHERE id = ${jobId}::uuid
  `);
  revalidatePath(`/external/${jobId}`);
  revalidatePath('/external');
}

// ── material links (reuse external_links) ────────────────────────────────────
export async function addMaterialLink(jobId: string, formData: FormData): Promise<void> {
  await actor();
  const url = str(formData.get('url'), 1000);
  if (!url) return;
  const provider = String(formData.get('provider') ?? 'other');
  await db.execute(sql`
    INSERT INTO external_links (entity_type, entity_id, provider, url, label)
    VALUES ('external_job', ${jobId}::uuid, ${provider}, ${url}, ${str(formData.get('label'), 160)})
  `);
  revalidatePath(`/external/${jobId}`);
}

export async function removeMaterialLink(jobId: string, linkId: string): Promise<void> {
  await actor();
  await db.execute(sql`DELETE FROM external_links WHERE id = ${linkId}::uuid AND entity_id = ${jobId}::uuid`);
  revalidatePath(`/external/${jobId}`);
}

// ── payments ─────────────────────────────────────────────────────────────────
export async function addPayment(jobId: string, formData: FormData): Promise<void> {
  const pid = await actor();
  const amount = num(formData.get('amount_sar'));
  if (amount == null || amount <= 0) return;
  const method = String(formData.get('method') ?? 'transfer');
  const paidAt = str(formData.get('paid_at'), 30);
  await db.execute(sql`
    INSERT INTO external_payments (job_id, amount_sar, method, paid_at, note, created_by)
    VALUES (
      ${jobId}::uuid, ${amount}::numeric, ${method},
      ${paidAt ? sql`${paidAt}::date` : sql`current_date`},
      ${str(formData.get('note'), 200)},
      ${pid ? sql`${pid}::uuid` : sql`NULL`}
    )
  `);
  revalidatePath(`/external/${jobId}`);
  revalidatePath('/external');
}

export async function deletePayment(jobId: string, paymentId: string): Promise<void> {
  await actor();
  await db.execute(sql`DELETE FROM external_payments WHERE id = ${paymentId}::uuid AND job_id = ${jobId}::uuid`);
  revalidatePath(`/external/${jobId}`);
  revalidatePath('/external');
}

// ── revisions ────────────────────────────────────────────────────────────────
export async function requestRevision(jobId: string, formData: FormData): Promise<void> {
  const pid = await actor();
  const note = str(formData.get('change_request'), 2000);
  if (!note) return;
  await db.execute(sql`
    INSERT INTO external_job_revisions (job_id, round_number, change_request, requested_by, status)
    VALUES (
      ${jobId}::uuid,
      (SELECT COALESCE(MAX(round_number), 0) + 1 FROM external_job_revisions WHERE job_id = ${jobId}::uuid),
      ${note}, ${pid ? sql`${pid}::uuid` : sql`NULL`}, 'open'
    )
  `);
  await db.execute(sql`UPDATE external_jobs SET status = 'revisions', updated_at = now() WHERE id = ${jobId}::uuid AND status NOT IN ('delivered','cancelled')`);
  revalidatePath(`/external/${jobId}`);
}

export async function setRevisionVersion(jobId: string, revisionId: string, formData: FormData): Promise<void> {
  await actor();
  const url = str(formData.get('version_url'), 1000);
  if (!url) return;
  await db.execute(sql`
    UPDATE external_job_revisions SET version_url = ${url}, status = 'submitted'
    WHERE id = ${revisionId}::uuid AND job_id = ${jobId}::uuid
  `);
  revalidatePath(`/external/${jobId}`);
}

export async function approveRevision(jobId: string, revisionId: string): Promise<void> {
  await actor();
  await db.execute(sql`
    UPDATE external_job_revisions SET status = 'approved', resolved_at = now()
    WHERE id = ${revisionId}::uuid AND job_id = ${jobId}::uuid
  `);
  revalidatePath(`/external/${jobId}`);
}

// ── final delivery (attachment uploaded via /api/upload) ─────────────────────
export async function setFinal(jobId: string, attachmentId: string): Promise<void> {
  await actor();
  await db.execute(sql`
    UPDATE external_jobs
    SET final_attachment_id = ${attachmentId}::uuid, status = 'delivered', delivered_at = now(), updated_at = now()
    WHERE id = ${jobId}::uuid
  `);
  revalidatePath(`/external/${jobId}`);
  revalidatePath('/external');
}
