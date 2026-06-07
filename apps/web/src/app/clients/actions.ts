'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { enrichCompanyFromWeb, indexMemory, assertAiBudget } from '@antagna/ai';
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

type NewClientFields = {
  nameAr: string;
  nameEn: string | null;
  legalName: string | null;
  clientType: string;
  industry: string | null;
  country: string;
  city: string | null;
  websiteUrl: string | null;
  vatNumber: string | null;
  crNumber: string | null;
  forBrandUnit: string;
};

/**
 * Shared client INSERT used by both the full form action and the quick-add
 * popup, so the two stay perfectly consistent. Auto-generates a unique `code`
 * (transliterated slug → numeric suffix → CLNT-NNN fallback) and — unlike the
 * old inline version — sets `is_agency` from `client_type` so an "agency"
 * actually lands under agencies (the brand/agency dropdowns filter on it).
 * Returns the new row's id/code/is_agency.
 */
async function insertClient(
  actorId: string,
  f: NewClientFields,
): Promise<{ id: string; code: string; isAgency: boolean }> {
  const slug = slugFromName(f.nameEn ?? f.nameAr);
  const isAgency = f.clientType === 'agency';
  const customFields = { for_brand_unit: f.forBrandUnit };

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
      tx.execute<{ id: string; is_agency: boolean }>(sql`
        INSERT INTO clients (code, name_ar, name_en, legal_name, client_type, is_agency,
                             industry, country, city, website_url, vat_number, cr_number,
                             custom_fields, created_by)
        VALUES (
          ${codeToUse}, ${f.nameAr}, ${f.nameEn}, ${f.legalName},
          ${f.clientType}::client_type, ${isAgency}, ${f.industry}, ${f.country}, ${f.city},
          ${f.websiteUrl}, ${f.vatNumber}, ${f.crNumber},
          ${JSON.stringify(customFields)}::jsonb,
          ${actorId}::uuid
        )
        RETURNING id, is_agency
      `),
    );

  let newId: string | undefined;
  let newIsAgency = isAgency;
  // First attempt with the pre-probed code, then deterministic CLNT-NNN
  // fallbacks if a concurrent insert grabbed the same code in between.
  const attempts: string[] = [code];
  for (let n = 1; n <= 50; n++) attempts.push(`CLNT-${String(n).padStart(3, '0')}`);
  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const res = (await insert(attempt)) as unknown as Array<{ id: string; is_agency: boolean }>;
      newId = res[0]?.id;
      newIsAgency = res[0]?.is_agency ?? isAgency;
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
  return { id: newId, code, isAgency: newIsAgency };
}

export async function createClient(formData: FormData) {
  const actorId = await requirePermissionAction('client.create');

  const nameAr = formData.get('nameAr')?.toString().trim();
  if (!nameAr) throw new Error('nameAr required');
  const nameEn = formData.get('nameEn')?.toString().trim() || null;

  // Industry: dropdown ('other' lets a free-text industryOther override).
  const industryPick = formData.get('industry')?.toString().trim() || null;
  const industryOther = formData.get('industryOther')?.toString().trim() || null;
  const industry = industryPick === 'other' ? industryOther || null : industryPick;

  // Code is auto-generated + is_agency derived inside insertClient (shared with
  // the quick-add popup so both creation paths behave identically).
  const { id: newId, code } = await insertClient(actorId, {
    nameAr,
    nameEn,
    legalName: formData.get('legalName')?.toString().trim() || null,
    clientType: formData.get('clientType')?.toString() || 'brand',
    industry,
    country: formData.get('country')?.toString().trim() || 'SA',
    city: formData.get('city')?.toString().trim() || null,
    websiteUrl: formData.get('websiteUrl')?.toString().trim() || null,
    vatNumber: formData.get('vatNumber')?.toString().trim() || null,
    crNumber: formData.get('crNumber')?.toString().trim() || null,
    // Which Volt sub-brand owns this client (Mohammed's spec).
    forBrandUnit: formData.get('forBrandUnit')?.toString() || 'volt_production',
  });

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

/**
 * Quick-add a client from inside another form (e.g. the new-project intake).
 * Unlike `createClient` it does NOT redirect — it returns the new row so the
 * caller can append + select it in place. Only the essentials are required;
 * the rest is editable later on the client page.
 */
export async function createClientQuick(input: {
  nameAr: string;
  nameEn?: string | null;
  clientType?: string;
  forBrandUnit?: string;
  industry?: string | null;
}): Promise<
  | { ok: true; client: { id: string; code: string; nameAr: string; isAgency: boolean } }
  | { ok: false; error: string }
> {
  const nameAr = input.nameAr?.trim();
  if (!nameAr) return { ok: false, error: 'الاسم (عربي) مطلوب' };

  let actorId: string;
  try {
    actorId = await requirePermissionAction('client.create');
  } catch {
    return { ok: false, error: 'لا تملك صلاحية إضافة عميل' };
  }

  const clientType = input.clientType || 'brand';
  try {
    const { id, code, isAgency } = await insertClient(actorId, {
      nameAr,
      nameEn: input.nameEn?.trim() || null,
      legalName: null,
      clientType,
      industry: input.industry?.trim() || null,
      country: 'SA',
      city: null,
      websiteUrl: null,
      vatNumber: null,
      crNumber: null,
      forBrandUnit: input.forBrandUnit || 'volt_production',
    });

    await writeActivity({
      actorId,
      entityType: 'client',
      entityId: id,
      action: 'client_created',
      summaryAr: `أُضيف عميل جديد: ${nameAr} (${code})`,
      summaryEn: `New client added: ${input.nameEn ?? nameAr} (${code})`,
    });

    revalidatePath('/crm');
    revalidatePath('/projects/new');
    return { ok: true, client: { id, code, nameAr, isAgency } };
  } catch (e) {
    const msg = String((e as { message?: string })?.message ?? e);
    return { ok: false, error: msg.slice(0, 180) };
  }
}

/**
 * AI client enrichment: research the company on the open web (Anthropic web
 * search), store a structured profile in custom_fields.enrichment, and feed the
 * brain (ai_memory_chunks) so future suggestions about this client are smarter.
 * Best-effort + budget-guarded; never throws to the caller.
 */
export async function enrichClientAction(
  clientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const actorId = await requirePermissionAction('client.update');

  const c = (
    (await db.execute(sql`
      SELECT name_ar AS "nameAr", name_en AS "nameEn",
             website_url AS "websiteUrl", country AS "country"
      FROM clients WHERE id = ${clientId}::uuid LIMIT 1`)) as unknown as Array<{
      nameAr: string;
      nameEn: string | null;
      websiteUrl: string | null;
      country: string | null;
    }>
  )[0];
  if (!c) return { ok: false, error: 'العميل غير موجود' };

  // Derive a domain: prefer the website, else the primary contact's email host
  // (skipping free mailbox providers, which tell us nothing about the company).
  let domain: string | null = null;
  if (c.websiteUrl) {
    domain = c.websiteUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim() || null;
  }
  if (!domain) {
    const em = (await db.execute(sql`
      SELECT cm.value AS email
      FROM contacts ct
      JOIN contact_methods cm ON cm.contact_id = ct.id
      WHERE ct.client_id = ${clientId}::uuid
        AND cm.method_type = 'email'::contact_method_type
      ORDER BY cm.is_primary DESC NULLS LAST
      LIMIT 1`)) as unknown as Array<{ email: string }>;
    const host = em[0]?.email?.split('@')[1]?.toLowerCase();
    if (host && !/(gmail|hotmail|outlook|yahoo|icloud|live|proton|aol)\./.test(host)) {
      domain = host;
    }
  }

  try {
    await assertAiBudget({ userId: actorId, feature: 'client_enrichment' });
  } catch {
    return { ok: false, error: 'تم تجاوز حد ميزانية الـ AI لهذا الشهر' };
  }

  const r = await enrichCompanyFromWeb({
    name: c.nameEn || c.nameAr,
    domain,
    country: c.country,
  });
  if (!r.ok) return { ok: false, error: r.error ?? 'تعذّر الإثراء' };

  const blob = {
    summary_ar: r.summaryAr ?? null,
    summary_en: r.summaryEn ?? null,
    industry: r.industry ?? null,
    website_url: r.websiteUrl ?? null,
    hq_location: r.hqLocation ?? null,
    company_size: r.companySize ?? null,
    key_facts: r.keyFacts ?? [],
    sources: r.sources ?? [],
    enriched_at: new Date().toISOString(),
  };

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE clients
      SET custom_fields = jsonb_set(
            COALESCE(custom_fields, '{}'::jsonb), '{enrichment}', ${JSON.stringify(blob)}::jsonb, true),
          website_url = COALESCE(website_url, ${r.websiteUrl ?? null}),
          updated_at = now()
      WHERE id = ${clientId}::uuid`),
  );

  // Feed the brain. Replace any prior enrichment chunk so a re-run refreshes it
  // (indexMemory is ON CONFLICT DO NOTHING, so we delete-then-insert).
  try {
    await db.execute(sql`
      DELETE FROM ai_memory_chunks
      WHERE source = 'client_enrichment' AND source_id = ${clientId}::uuid`);
    const memText = [
      `العميل: ${c.nameAr}${c.nameEn ? ` (${c.nameEn})` : ''}`,
      r.summaryAr,
      r.industry ? `القطاع: ${r.industry}` : '',
      r.keyFacts && r.keyFacts.length ? `حقائق: ${r.keyFacts.join(' · ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    if (memText.trim()) {
      await indexMemory({
        scope: 'client',
        scopeId: clientId,
        source: 'client_enrichment',
        sourceId: clientId,
        content: memText,
        contentLang: 'ar',
        metadata: { kind: 'enrichment', sources: r.sources ?? [] },
      });
    }
  } catch (e) {
    console.error('[enrichClientAction memory]', e);
  }

  await writeActivity({
    actorId,
    entityType: 'client',
    entityId: clientId,
    action: 'client_enriched',
    summaryAr: 'أثرى الـ AI بيانات العميل من بحث الويب',
    summaryEn: 'AI enriched client from web research',
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
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
