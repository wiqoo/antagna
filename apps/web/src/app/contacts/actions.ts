'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

/**
 * First-class Contacts directory actions.
 *
 * In volt-os, contacts lived only under a client. Here they're a top-level
 * directory, but the data model is unchanged: `contacts.client_id` is NOT NULL
 * — every contact still belongs to a client. The create form therefore REQUIRES
 * a client selection.
 *
 * Each method (email / phone / whatsapp) lands in `contact_methods` inside the
 * SAME actor-scoped transaction so the audit trigger sees the principal and the
 * write is all-or-nothing. `contact_methods` has a UNIQUE(method_type,
 * normalized_value) constraint → ON CONFLICT DO NOTHING keeps a duplicate from
 * aborting the whole insert.
 */

function normalizePhone(v: string): string {
  return v.replace(/[^0-9+]/g, '');
}

type ContactMethodType = 'email' | 'phone' | 'whatsapp' | 'linkedin' | 'instagram' | 'other';

/** Normalize a method value for the UNIQUE(method_type, normalized_value) key. */
function normalizeMethodValue(type: ContactMethodType, value: string): string {
  if (type === 'phone' || type === 'whatsapp') return normalizePhone(value);
  // email / linkedin / instagram / other → case-insensitive, trimmed.
  return value.trim().toLowerCase();
}

/** Replace all contact_methods of a given type for a contact, inside an open tx. */
async function syncMethod(
  tx: Parameters<Parameters<typeof withActor>[1]>[0],
  contactId: string,
  type: ContactMethodType,
  value: string | null,
  isPrimary = false,
) {
  // Always clear the prior value(s) of this type for this contact so an edit
  // that blanks a field actually removes it.
  await tx.execute(sql`
    DELETE FROM contact_methods
    WHERE contact_id = ${contactId}::uuid AND method_type = ${type}::contact_method_type
  `);
  if (!value) return;
  const normalized = normalizeMethodValue(type, value);
  await tx.execute(sql`
    INSERT INTO contact_methods (contact_id, method_type, value, normalized_value, is_primary)
    VALUES (${contactId}::uuid, ${type}::contact_method_type, ${value}, ${normalized}, ${isPrimary})
    ON CONFLICT DO NOTHING
  `);
}

export async function createContact(formData: FormData) {
  const actorId = await requirePermissionAction('contact.create');

  const clientId = formData.get('clientId')?.toString().trim();
  const fullName = formData.get('fullName')?.toString().trim();
  const fullNameAr = formData.get('fullNameAr')?.toString().trim() || null;
  const jobTitle = formData.get('jobTitle')?.toString().trim() || null;
  const department = formData.get('department')?.toString().trim() || null;
  const email = formData.get('email')?.toString().trim() || null;
  const phone = formData.get('phone')?.toString().trim() || null;
  const whatsapp = formData.get('whatsapp')?.toString().trim() || null;
  const linkedin = formData.get('linkedin')?.toString().trim() || null;
  const instagram = formData.get('instagram')?.toString().trim() || null;
  const other = formData.get('other')?.toString().trim() || null;
  const isPrimary = formData.get('isPrimary') === 'on';
  const isDecisionMaker = formData.get('isDecisionMaker') === 'on';
  const notes = formData.get('notes')?.toString().trim() || null;

  if (!clientId) throw new Error('clientId required');
  if (!fullName) throw new Error('fullName required');

  const newId = await withActor(actorId, async (tx) => {
    const res = await tx.execute<{ id: string }>(sql`
      INSERT INTO contacts (client_id, full_name, full_name_ar, job_title,
                            department, is_primary, is_decision_maker, notes)
      VALUES (
        ${clientId}::uuid, ${fullName}, ${fullNameAr}, ${jobTitle},
        ${department}, ${isPrimary}, ${isDecisionMaker}, ${notes}
      )
      RETURNING id
    `);
    const id = (res as unknown as Array<{ id: string }>)[0]?.id;
    if (!id) return null;
    await syncMethod(tx, id, 'email', email, true);
    await syncMethod(tx, id, 'phone', phone);
    await syncMethod(tx, id, 'whatsapp', whatsapp);
    await syncMethod(tx, id, 'linkedin', linkedin);
    await syncMethod(tx, id, 'instagram', instagram);
    await syncMethod(tx, id, 'other', other);
    return id;
  });

  if (!newId) throw new Error('insert failed');

  await writeActivity({
    actorId,
    entityType: 'contact',
    entityId: newId,
    action: 'contact_created',
    summaryAr: `أُضيفت جهة اتصال: ${fullName}`,
    summaryEn: `Contact added: ${fullName}`,
    metadata: { client_id: clientId },
  });

  revalidatePath('/contacts');
  revalidatePath(`/clients/${clientId}`);
  redirect(`/contacts/${newId}`);
}

export async function updateContact(contactId: string, formData: FormData) {
  const actorId = await requirePermissionAction('contact.update');

  const fullName = formData.get('fullName')?.toString().trim();
  const fullNameAr = formData.get('fullNameAr')?.toString().trim() || null;
  const jobTitle = formData.get('jobTitle')?.toString().trim() || null;
  const department = formData.get('department')?.toString().trim() || null;
  const email = formData.get('email')?.toString().trim() || null;
  const phone = formData.get('phone')?.toString().trim() || null;
  const whatsapp = formData.get('whatsapp')?.toString().trim() || null;
  const linkedin = formData.get('linkedin')?.toString().trim() || null;
  const instagram = formData.get('instagram')?.toString().trim() || null;
  const other = formData.get('other')?.toString().trim() || null;
  const isPrimary = formData.get('isPrimary') === 'on';
  const isDecisionMaker = formData.get('isDecisionMaker') === 'on';
  const notes = formData.get('notes')?.toString().trim() || null;

  if (!fullName) throw new Error('fullName required');

  const clientId = await withActor(actorId, async (tx) => {
    const res = await tx.execute<{ client_id: string }>(sql`
      UPDATE contacts SET
        full_name = ${fullName},
        full_name_ar = ${fullNameAr},
        job_title = ${jobTitle},
        department = ${department},
        is_primary = ${isPrimary},
        is_decision_maker = ${isDecisionMaker},
        notes = ${notes},
        updated_at = now()
      WHERE id = ${contactId}::uuid
      RETURNING client_id
    `);
    const cid = (res as unknown as Array<{ client_id: string }>)[0]?.client_id;
    await syncMethod(tx, contactId, 'email', email, true);
    await syncMethod(tx, contactId, 'phone', phone);
    await syncMethod(tx, contactId, 'whatsapp', whatsapp);
    await syncMethod(tx, contactId, 'linkedin', linkedin);
    await syncMethod(tx, contactId, 'instagram', instagram);
    await syncMethod(tx, contactId, 'other', other);
    return cid ?? null;
  });

  await writeActivity({
    actorId,
    entityType: 'contact',
    entityId: contactId,
    action: 'contact_updated',
    summaryAr: `حُدّثت جهة الاتصال: ${fullName}`,
    summaryEn: `Contact updated: ${fullName}`,
  });

  revalidatePath('/contacts');
  revalidatePath(`/contacts/${contactId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  redirect(`/contacts/${contactId}`);
}

export async function archiveContact(contactId: string) {
  const actorId = await requirePermissionAction('contact.update');
  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE contacts SET archived_at = now(), updated_at = now()
      WHERE id = ${contactId}::uuid
    `),
  );
  await writeActivity({
    actorId,
    entityType: 'contact',
    entityId: contactId,
    action: 'contact_archived',
    summaryAr: 'أُرشِفت جهة الاتصال',
    summaryEn: 'Contact archived',
  });
  revalidatePath('/contacts');
  redirect('/contacts');
}
