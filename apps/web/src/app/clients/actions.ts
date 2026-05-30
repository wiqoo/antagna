'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

/**
 * Build a code slug from a name. Latin letters pass through; common Arabic
 * letters are transliterated so an Arabic-only name no longer collapses to the
 * literal 'CLNT'. Falls back to 'CLNT' only when nothing usable remains.
 */
const AR_TRANSLIT: Record<string, string> = {
  ا: 'A', أ: 'A', إ: 'A', آ: 'A', ب: 'B', ت: 'T', ث: 'TH', ج: 'J', ح: 'H',
  خ: 'KH', د: 'D', ذ: 'TH', ر: 'R', ز: 'Z', س: 'S', ش: 'SH', ص: 'S', ض: 'D',
  ط: 'T', ظ: 'Z', ع: 'A', غ: 'GH', ف: 'F', ق: 'Q', ك: 'K', ل: 'L', م: 'M',
  ن: 'N', ه: 'H', و: 'W', ي: 'Y', ى: 'A', ة: 'H', ء: 'A', ئ: 'Y', ؤ: 'W',
};

function slugFromName(name: string): string {
  const transliterated = Array.from(name)
    .map((ch) => AR_TRANSLIT[ch] ?? ch)
    .join('');
  const cleaned = transliterated.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6);
  return cleaned || 'CLNT';
}

export async function createClient(formData: FormData) {
  const actorId = await requirePermissionAction('client.create');

  const nameAr = formData.get('nameAr')?.toString().trim();
  const nameEn = formData.get('nameEn')?.toString().trim() || null;
  const legalName = formData.get('legalName')?.toString().trim() || null;
  const clientType = formData.get('clientType')?.toString() || 'brand';
  // Industry: dropdown ('other' lets a free-text industryOther override).
  const industryPick = formData.get('industry')?.toString().trim() || null;
  const industryOther = formData.get('industryOther')?.toString().trim() || null;
  const industry =
    industryPick === 'other'
      ? industryOther || null
      : industryPick;
  const country = formData.get('country')?.toString().trim() || 'SA';
  const city = formData.get('city')?.toString().trim() || null;
  const websiteUrl = formData.get('websiteUrl')?.toString().trim() || null;
  const vatNumber = formData.get('vatNumber')?.toString().trim() || null;
  const crNumber = formData.get('crNumber')?.toString().trim() || null;
  // Which Volt sub-brand owns this client (Mohammed's spec).
  const forBrandUnit = formData.get('forBrandUnit')?.toString() || 'volt_production';

  if (!nameAr) throw new Error('nameAr required');

  // Auto-generate a code from the English (or Arabic) name — Mohammed's audit
  // flagged the visible-but-useless Code field. Server keeps it for the URL
  // segment + Dafterah ref but never asks the user. We transliterate Arabic so
  // Arabic-only names don't all collapse to 'CLNT', pre-probe for a free slug,
  // and (because `clients.code` is UNIQUE and another request could race us)
  // retry the INSERT on a unique violation with a sequential CLNT-NNN fallback.
  const slug = slugFromName(nameEn ?? nameAr);
  const customFields = { for_brand_unit: forBrandUnit };

  // Pre-probe candidate codes: slug, slug2, slug3 … up to slug99.
  const candidates: string[] = [slug];
  for (let suffix = 2; suffix < 100; suffix++) candidates.push(`${slug}${suffix}`);

  let code = slug;
  for (const cand of candidates) {
    const rs = (await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM clients WHERE code = ${cand}`,
    )) as unknown as { n: number }[];
    if ((rs[0]?.n ?? 0) === 0) {
      code = cand;
      break;
    }
  }

  const insert = (codeToUse: string) =>
    withActor(actorId, (tx) =>
      tx.execute<{ id: string }>(sql`
        INSERT INTO clients (code, name_ar, name_en, legal_name, client_type, industry,
                             country, city, website_url, vat_number, cr_number,
                             custom_fields, created_by)
        VALUES (
          ${codeToUse}, ${nameAr}, ${nameEn}, ${legalName},
          ${clientType}::client_type, ${industry}, ${country}, ${city},
          ${websiteUrl}, ${vatNumber}, ${crNumber},
          ${JSON.stringify(customFields)}::jsonb,
          ${actorId}::uuid
        )
        RETURNING id
      `),
    );

  let newId: string | undefined;
  // First attempt with the pre-probed code, then deterministic CLNT-NNN
  // fallbacks if a concurrent insert grabbed the same code in between.
  const attempts: string[] = [code];
  for (let n = 1; n <= 50; n++) attempts.push(`CLNT-${String(n).padStart(3, '0')}`);
  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const res = await insert(attempt);
      newId = (res as unknown as Array<{ id: string }>)[0]?.id;
      code = attempt;
      break;
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      // Unique violation on the code column → try the next candidate.
      if (/duplicate key|unique constraint|23505/i.test(msg)) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  if (!newId) throw lastErr ?? new Error('insert failed');

  await writeActivity({
    actorId,
    entityType: 'client',
    entityId: newId,
    action: 'client_created',
    summaryAr: `أُضيف عميل جديد: ${nameAr} (${code})`,
    summaryEn: `New client added: ${nameEn ?? nameAr} (${code})`,
  });

  // Converting from a lead? Link it to the new client + mark qualified.
  const leadId = formData.get('leadId')?.toString();
  if (leadId) {
    await withActor(actorId, (tx) =>
      tx.execute(sql`
        UPDATE leads
        SET client_id = ${newId}::uuid, status = 'qualified'::lead_status, updated_at = now()
        WHERE id = ${leadId}::uuid
      `),
    );
    await writeActivity({
      actorId,
      entityType: 'lead',
      entityId: leadId,
      action: 'lead_converted',
      summaryAr: `حُوّلت الفرصة إلى عميل: ${nameAr}`,
      summaryEn: `Lead converted to client: ${nameEn ?? nameAr}`,
      metadata: { client_id: newId },
    });
    revalidatePath('/crm');
  }

  revalidatePath('/crm');
  redirect(`/clients/${newId}`);
}

export async function updateClient(clientId: string, formData: FormData) {
  const actorId = await requirePermissionAction('client.update');

  const nameAr = formData.get('nameAr')?.toString().trim();
  const nameEn = formData.get('nameEn')?.toString().trim() || null;
  const legalName = formData.get('legalName')?.toString().trim() || null;
  const clientType = formData.get('clientType')?.toString() || 'brand';
  // Industry: dropdown ('other' lets a free-text industryOther override) —
  // mirrors createClient so the edit page's dropdown + 'other' pattern stores
  // the typed custom value instead of the literal 'other'.
  const industryPick = formData.get('industry')?.toString().trim() || null;
  const industryOther = formData.get('industryOther')?.toString().trim() || null;
  const industry =
    industryPick === 'other' ? industryOther || null : industryPick;
  const country = formData.get('country')?.toString().trim() || 'SA';
  const city = formData.get('city')?.toString().trim() || null;
  const websiteUrl = formData.get('websiteUrl')?.toString().trim() || null;
  const vatNumber = formData.get('vatNumber')?.toString().trim() || null;
  const crNumber = formData.get('crNumber')?.toString().trim() || null;
  const notes = formData.get('notes')?.toString() || null;

  await withActor(actorId, (tx) =>
    tx.execute(sql`
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
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'client',
    entityId: clientId,
    action: 'client_updated',
    summaryAr: `حُدّثت بيانات العميل${nameAr ? `: ${nameAr}` : ''}`,
    summaryEn: 'Client details updated',
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/crm');
  redirect(`/clients/${clientId}`);
}

export async function addContact(clientId: string, formData: FormData) {
  const actorId = await requirePermissionAction('contact.create');

  const fullName = formData.get('fullName')?.toString().trim();
  const fullNameAr = formData.get('fullNameAr')?.toString().trim() || null;
  const jobTitle = formData.get('jobTitle')?.toString().trim() || null;
  const email = formData.get('email')?.toString().trim() || null;
  const phone = formData.get('phone')?.toString().trim() || null;
  const whatsapp = formData.get('whatsapp')?.toString().trim() || null;
  const isPrimary = formData.get('isPrimary') === 'on';
  const isDecisionMaker = formData.get('isDecisionMaker') === 'on';

  // Was a silent `return;` — surface a structured error instead so the caller
  // can show feedback rather than the form appearing to no-op.
  if (!fullName) {
    return { ok: false as const, error: 'الاسم الكامل مطلوب' };
  }

  // Contact + its contact_methods all go through one actor-scoped transaction
  // so the audit trigger sees the acting principal and either everything or
  // nothing lands.
  const contactId = await withActor(actorId, async (tx) => {
    const res = await tx.execute<{ id: string }>(sql`
      INSERT INTO contacts (client_id, full_name, full_name_ar, job_title,
                            is_primary, is_decision_maker)
      VALUES (
        ${clientId}::uuid, ${fullName}, ${fullNameAr}, ${jobTitle},
        ${isPrimary}, ${isDecisionMaker}
      )
      RETURNING id
    `);
    const id = (res as unknown as Array<{ id: string }>)[0]?.id;
    if (!id) return null;

    if (email) {
      await tx.execute(sql`
        INSERT INTO contact_methods (contact_id, method_type, value, normalized_value, is_primary)
        VALUES (${id}::uuid, 'email'::contact_method_type, ${email}, LOWER(${email}), true)
        ON CONFLICT DO NOTHING
      `);
    }
    if (phone) {
      await tx.execute(sql`
        INSERT INTO contact_methods (contact_id, method_type, value, normalized_value)
        VALUES (${id}::uuid, 'phone'::contact_method_type, ${phone}, REGEXP_REPLACE(${phone}, '[^0-9+]', '', 'g'))
        ON CONFLICT DO NOTHING
      `);
    }
    if (whatsapp) {
      await tx.execute(sql`
        INSERT INTO contact_methods (contact_id, method_type, value, normalized_value)
        VALUES (${id}::uuid, 'whatsapp'::contact_method_type, ${whatsapp}, REGEXP_REPLACE(${whatsapp}, '[^0-9+]', '', 'g'))
        ON CONFLICT DO NOTHING
      `);
    }
    return id;
  });

  if (!contactId) {
    return { ok: false as const, error: 'تعذّر إضافة جهة الاتصال' };
  }

  await writeActivity({
    actorId,
    entityType: 'client',
    entityId: clientId,
    action: 'contact_added',
    summaryAr: `أُضيفت جهة اتصال: ${fullName}`,
    summaryEn: `Contact added: ${fullName}`,
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true as const };
}

export async function archiveClient(clientId: string) {
  const actorId = await requirePermissionAction('client.update');
  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE clients SET archived_at = now() WHERE id = ${clientId}::uuid
    `),
  );
  await writeActivity({
    actorId,
    entityType: 'client',
    entityId: clientId,
    action: 'client_archived',
    summaryAr: 'أُرشِف العميل',
    summaryEn: 'Client archived',
  });
  revalidatePath('/crm');
  redirect('/crm');
}
