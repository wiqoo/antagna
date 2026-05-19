'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

async function withActor() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (actor) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${actor.id}, true)`);
  }
  return actor?.id ?? null;
}

export async function createClient(formData: FormData) {
  const actorId = await withActor();

  const code = formData.get('code')?.toString().trim().toUpperCase();
  const nameAr = formData.get('nameAr')?.toString().trim();
  const nameEn = formData.get('nameEn')?.toString().trim() || null;
  const legalName = formData.get('legalName')?.toString().trim() || null;
  const clientType = formData.get('clientType')?.toString() || 'brand';
  const industry = formData.get('industry')?.toString().trim() || null;
  const country = formData.get('country')?.toString().trim() || 'SA';
  const city = formData.get('city')?.toString().trim() || null;
  const websiteUrl = formData.get('websiteUrl')?.toString().trim() || null;
  const vatNumber = formData.get('vatNumber')?.toString().trim() || null;
  const crNumber = formData.get('crNumber')?.toString().trim() || null;

  if (!code || !nameAr) throw new Error('code + nameAr required');

  const res = await db.execute<{ id: string }>(sql`
    INSERT INTO clients (code, name_ar, name_en, legal_name, client_type, industry,
                         country, city, website_url, vat_number, cr_number, created_by)
    VALUES (
      ${code}, ${nameAr}, ${nameEn}, ${legalName},
      ${clientType}::client_type, ${industry}, ${country}, ${city},
      ${websiteUrl}, ${vatNumber}, ${crNumber},
      ${actorId ? sql`${actorId}::uuid` : sql`NULL`}
    )
    RETURNING id
  `);
  const newId = (res as unknown as Array<{ id: string }>)[0]?.id;
  if (!newId) throw new Error('insert failed');

  revalidatePath('/crm');
  redirect(`/clients/${newId}`);
}

export async function updateClient(clientId: string, formData: FormData) {
  await withActor();

  const nameAr = formData.get('nameAr')?.toString().trim();
  const nameEn = formData.get('nameEn')?.toString().trim() || null;
  const legalName = formData.get('legalName')?.toString().trim() || null;
  const clientType = formData.get('clientType')?.toString() || 'brand';
  const industry = formData.get('industry')?.toString().trim() || null;
  const country = formData.get('country')?.toString().trim() || 'SA';
  const city = formData.get('city')?.toString().trim() || null;
  const websiteUrl = formData.get('websiteUrl')?.toString().trim() || null;
  const vatNumber = formData.get('vatNumber')?.toString().trim() || null;
  const crNumber = formData.get('crNumber')?.toString().trim() || null;
  const notes = formData.get('notes')?.toString() || null;

  await db.execute(sql`
    UPDATE clients SET
      name_ar = COALESCE(${nameAr}, name_ar),
      name_en = ${nameEn},
      legal_name = ${legalName},
      client_type = ${clientType}::client_type,
      industry = ${industry},
      country = ${country},
      city = ${city},
      website_url = ${websiteUrl},
      vat_number = ${vatNumber},
      cr_number = ${crNumber},
      notes = ${notes},
      updated_at = now()
    WHERE id = ${clientId}::uuid
  `);

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/crm');
  redirect(`/clients/${clientId}`);
}

export async function addContact(clientId: string, formData: FormData) {
  await withActor();

  const fullName = formData.get('fullName')?.toString().trim();
  const fullNameAr = formData.get('fullNameAr')?.toString().trim() || null;
  const jobTitle = formData.get('jobTitle')?.toString().trim() || null;
  const email = formData.get('email')?.toString().trim() || null;
  const phone = formData.get('phone')?.toString().trim() || null;
  const whatsapp = formData.get('whatsapp')?.toString().trim() || null;
  const isPrimary = formData.get('isPrimary') === 'on';
  const isDecisionMaker = formData.get('isDecisionMaker') === 'on';

  if (!fullName) return;

  const res = await db.execute<{ id: string }>(sql`
    INSERT INTO contacts (client_id, full_name, full_name_ar, job_title,
                          is_primary, is_decision_maker)
    VALUES (
      ${clientId}::uuid, ${fullName}, ${fullNameAr}, ${jobTitle},
      ${isPrimary}, ${isDecisionMaker}
    )
    RETURNING id
  `);
  const contactId = (res as unknown as Array<{ id: string }>)[0]?.id;

  if (contactId) {
    if (email) {
      await db.execute(sql`
        INSERT INTO contact_methods (contact_id, method_type, value, normalized_value, is_primary)
        VALUES (${contactId}::uuid, 'email'::contact_method_type, ${email}, LOWER(${email}), true)
        ON CONFLICT DO NOTHING
      `);
    }
    if (phone) {
      await db.execute(sql`
        INSERT INTO contact_methods (contact_id, method_type, value, normalized_value)
        VALUES (${contactId}::uuid, 'phone'::contact_method_type, ${phone}, REGEXP_REPLACE(${phone}, '[^0-9+]', '', 'g'))
        ON CONFLICT DO NOTHING
      `);
    }
    if (whatsapp) {
      await db.execute(sql`
        INSERT INTO contact_methods (contact_id, method_type, value, normalized_value)
        VALUES (${contactId}::uuid, 'whatsapp'::contact_method_type, ${whatsapp}, REGEXP_REPLACE(${whatsapp}, '[^0-9+]', '', 'g'))
        ON CONFLICT DO NOTHING
      `);
    }
  }

  revalidatePath(`/clients/${clientId}`);
}

export async function archiveClient(clientId: string) {
  await withActor();
  await db.execute(sql`
    UPDATE clients SET archived_at = now() WHERE id = ${clientId}::uuid
  `);
  revalidatePath('/crm');
  redirect('/crm');
}
