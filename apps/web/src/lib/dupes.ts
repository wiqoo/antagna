/**
 * Smart duplicate detection — clients / projects / contacts.
 *
 * Each finder runs an exact-match pass (lowercased / normalized) plus a
 * pg_trgm similarity pass (≥0.55), returning at most 5 candidates ordered
 * by score. Callers decide whether to block or surface as a soft alert.
 *
 * Migration 047 ships the gin trigram indexes; queries stay sub-50ms.
 */
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

export type DupeMatch = {
  id: string;
  code: string | null;
  label: string;
  score: number;
  reason: string;
};

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

/** Normalize a string for comparison: lowercased, collapsed whitespace, no punctuation. */
function norm(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function urlHost(u: string | null | undefined): string {
  if (!u) return '';
  try {
    return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function findClientDuplicates(input: {
  nameAr: string;
  nameEn?: string | null;
  legalName?: string | null;
  websiteUrl?: string | null;
  vatNumber?: string | null;
  crNumber?: string | null;
}): Promise<DupeMatch[]> {
  const arN = norm(input.nameAr);
  const enN = norm(input.nameEn);
  const lgN = norm(input.legalName);
  const host = urlHost(input.websiteUrl);
  const vat = input.vatNumber?.trim() || null;
  const cr = input.crNumber?.trim() || null;

  const candidates = rows<{
    id: string;
    code: string;
    name_ar: string;
    name_en: string | null;
    legal_name: string | null;
    website_url: string | null;
    vat_number: string | null;
    cr_number: string | null;
    s_ar: number;
    s_en: number;
    s_lg: number;
  }>(
    await db.execute(sql`
      SELECT id::text AS id, code, name_ar, name_en, legal_name, website_url,
             vat_number, cr_number,
             similarity(name_ar, ${input.nameAr})::float8 AS s_ar,
             similarity(COALESCE(name_en, ''), ${input.nameEn ?? ''})::float8 AS s_en,
             similarity(COALESCE(legal_name, ''), ${input.legalName ?? ''})::float8 AS s_lg
      FROM clients
      WHERE archived_at IS NULL AND (
            LOWER(name_ar) = ${arN}
         OR (${enN} <> '' AND LOWER(COALESCE(name_en, '')) = ${enN})
         OR (${lgN} <> '' AND LOWER(COALESCE(legal_name, '')) = ${lgN})
         OR (${host} <> '' AND COALESCE(website_url, '') ILIKE ${'%' + host + '%'})
         OR (${vat ?? ''} <> '' AND vat_number = ${vat})
         OR (${cr ?? ''} <> '' AND cr_number = ${cr})
         OR similarity(name_ar, ${input.nameAr}) > 0.55
         OR (${input.nameEn ?? ''} <> '' AND similarity(COALESCE(name_en, ''), ${input.nameEn ?? ''}) > 0.55)
         OR (${input.legalName ?? ''} <> '' AND similarity(COALESCE(legal_name, ''), ${input.legalName ?? ''}) > 0.55)
      )
      LIMIT 10
    `),
  );

  const matches: DupeMatch[] = candidates.map((c) => {
    let reason = '';
    let score = Math.max(Number(c.s_ar) || 0, Number(c.s_en) || 0, Number(c.s_lg) || 0);
    if (norm(c.name_ar) === arN) { score = 1; reason = 'الاسم العربي مطابق'; }
    else if (enN && norm(c.name_en) === enN) { score = 1; reason = 'الاسم الإنجليزي مطابق'; }
    else if (lgN && norm(c.legal_name) === lgN) { score = 1; reason = 'الاسم القانوني مطابق'; }
    else if (host && (c.website_url ?? '').includes(host)) { score = Math.max(score, 0.95); reason = 'الموقع الإلكتروني مطابق'; }
    else if (vat && c.vat_number === vat) { score = 1; reason = 'الرقم الضريبي مطابق'; }
    else if (cr && c.cr_number === cr) { score = 1; reason = 'رقم السجل التجاري مطابق'; }
    else { reason = `تشابه ${Math.round(score * 100)}%`; }
    return { id: c.id, code: c.code, label: c.name_ar, score, reason };
  });

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 5);
}

export async function findProjectDuplicates(input: {
  clientId?: string | null;
  title: string;
  titleAr?: string | null;
}): Promise<DupeMatch[]> {
  const titleN = norm(input.title);
  const titleArN = norm(input.titleAr);
  const candidates = rows<{
    id: string; code: string; title: string; title_ar: string | null;
    s_en: number; s_ar: number;
  }>(
    await db.execute(sql`
      SELECT id::text AS id, code, title, title_ar,
             similarity(title, ${input.title})::float8 AS s_en,
             similarity(COALESCE(title_ar, ''), ${input.titleAr ?? ''})::float8 AS s_ar
      FROM projects
      WHERE archived_at IS NULL
        AND (${input.clientId ?? ''} = '' OR client_id = ${input.clientId ?? null}::uuid)
        AND (
            LOWER(title) = ${titleN}
         OR (${titleArN} <> '' AND LOWER(COALESCE(title_ar, '')) = ${titleArN})
         OR similarity(title, ${input.title}) > 0.55
         OR (${input.titleAr ?? ''} <> '' AND similarity(COALESCE(title_ar, ''), ${input.titleAr ?? ''}) > 0.55)
      )
      LIMIT 10
    `),
  );
  return candidates
    .map((c) => {
      const score = Math.max(Number(c.s_en) || 0, Number(c.s_ar) || 0);
      const exact = norm(c.title) === titleN || (titleArN && norm(c.title_ar) === titleArN);
      return {
        id: c.id,
        code: c.code,
        label: c.title_ar || c.title,
        score: exact ? 1 : score,
        reason: exact ? 'العنوان مطابق' : `تشابه ${Math.round(score * 100)}%`,
      } as DupeMatch;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export async function findContactDuplicates(input: {
  clientId?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
}): Promise<DupeMatch[]> {
  const nameN = norm(input.fullName);
  const emailLower = (input.email ?? '').toLowerCase().trim();
  const phoneNorm = (input.phone ?? '').replace(/[^0-9]/g, '');

  const candidates = rows<{
    id: string; full_name: string; s: number;
    matched_email: string | null; matched_phone: string | null;
  }>(
    await db.execute(sql`
      SELECT c.id::text AS id, c.full_name,
             similarity(c.full_name, ${input.fullName})::float8 AS s,
             (SELECT value FROM contact_methods cm
                WHERE cm.contact_id = c.id AND cm.method_type = 'email'
                  AND ${emailLower} <> '' AND LOWER(cm.normalized_value) = ${emailLower}
                LIMIT 1) AS matched_email,
             (SELECT value FROM contact_methods cm
                WHERE cm.contact_id = c.id AND cm.method_type = 'phone'
                  AND ${phoneNorm} <> '' AND cm.normalized_value = ${phoneNorm}
                LIMIT 1) AS matched_phone
      FROM contacts c
      WHERE c.archived_at IS NULL
        AND (${input.clientId ?? ''} = '' OR c.client_id = ${input.clientId ?? null}::uuid)
        AND (
             LOWER(c.full_name) = ${nameN}
          OR similarity(c.full_name, ${input.fullName}) > 0.6
          OR EXISTS (SELECT 1 FROM contact_methods cm WHERE cm.contact_id = c.id
                     AND ((cm.method_type='email' AND ${emailLower} <> '' AND LOWER(cm.normalized_value) = ${emailLower})
                       OR (cm.method_type='phone' AND ${phoneNorm} <> '' AND cm.normalized_value = ${phoneNorm})))
        )
      LIMIT 10
    `),
  );
  return candidates
    .map((c) => {
      let reason = `تشابه ${Math.round((c.s || 0) * 100)}%`;
      let score = Number(c.s) || 0;
      if (c.matched_email) { score = 1; reason = 'البريد الإلكتروني مطابق'; }
      else if (c.matched_phone) { score = 1; reason = 'رقم الجوال مطابق'; }
      else if (norm(c.full_name) === nameN) { score = 1; reason = 'الاسم مطابق'; }
      return { id: c.id, code: null, label: c.full_name, score, reason } as DupeMatch;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
