'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { parseStr } from '@/lib/parse';
import {
  ASSET_CATEGORIES,
  COMPANY_ASSET_ENTITY,
  COMPANY_ASSET_ID,
} from './constants';

/**
 * Company Assets register — server actions.
 *
 * Company-level assets (contracts, licences, brand kits, insurance docs,
 * registration papers, etc.) are stored in the polymorphic `attachments`
 * table under a fixed entity_type so they group together as one "company"
 * bucket, independent of any project/client/equipment row.
 *
 * The actual byte upload + the attachments INSERT happen through the existing
 * /api/upload route (signed-URL two-step) + the FileUpload component. These
 * server actions cover the metadata mutations that the upload route doesn't:
 * setting a description/category at create time and editing/removing later —
 * always gated + inside withActor so the audit trail records the real actor.
 */

function encodeDescription(category: string, note: string | null): string | null {
  const safeCat = (ASSET_CATEGORIES as readonly string[]).includes(category)
    ? category
    : 'other';
  const tag = `[${safeCat}]`;
  if (!note) return tag;
  return `${tag} ${note}`;
}

/**
 * Set the category + note on an attachment that was just uploaded via the
 * /api/upload route (the row already exists; we only enrich its description).
 * Gated on access.manage (company-wide assets are an admin/manager concern).
 */
export async function setAssetMeta(formData: FormData): Promise<void> {
  const aid = await requirePermissionAction('access.manage');

  const attachmentId = parseStr(formData.get('attachmentId'));
  const category = parseStr(formData.get('category')) ?? 'other';
  const note = parseStr(formData.get('note'));
  if (!attachmentId) return;

  const description = encodeDescription(category, note);

  await withActor(aid, (tx) =>
    tx.execute(sql`
      UPDATE attachments
      SET description = ${description}
      WHERE id = ${attachmentId}::uuid
        AND entity_type = ${COMPANY_ASSET_ENTITY}
    `),
  );
  revalidatePath('/assets');
}

/** Register an external-URL asset (e.g. a Google Drive / SharePoint link) with
 * no byte upload — useful for documents that already live elsewhere. */
export async function addExternalAsset(formData: FormData): Promise<void> {
  const aid = await requirePermissionAction('access.manage');

  const filename = parseStr(formData.get('filename'));
  const externalUrl = parseStr(formData.get('externalUrl'));
  const category = parseStr(formData.get('category')) ?? 'other';
  const note = parseStr(formData.get('note'));
  if (!filename || !externalUrl) throw new Error('filename + externalUrl required');

  // Basic URL sanity — reject anything that isn't http(s).
  if (!/^https?:\/\//i.test(externalUrl)) throw new Error('invalid url');

  const description = encodeDescription(category, note);

  await withActor(aid, (tx) =>
    tx.execute(sql`
      INSERT INTO attachments (
        entity_type, entity_id, filename, mime_type, size_bytes,
        storage_provider, external_url, uploaded_by_id, description
      ) VALUES (
        ${COMPANY_ASSET_ENTITY}, ${COMPANY_ASSET_ID}::uuid, ${filename},
        'text/uri-list', 0::bigint,
        'external_url', ${externalUrl}, ${aid}::uuid, ${description}
      )
    `),
  );
  revalidatePath('/assets');
}

/** Same as addExternalAsset but redirects to /assets after — used by the
 * dedicated /assets/new page (a plain server-rendered form post). */
export async function addExternalAssetAndRedirect(formData: FormData): Promise<void> {
  await addExternalAsset(formData);
  redirect('/assets');
}

/** Remove a company asset row (and best-effort delete the stored object handled
 * separately by /api/upload DELETE for uploaded files; here we just drop the
 * metadata row for external-URL entries). Gated on access.manage. */
export async function deleteCompanyAsset(formData: FormData): Promise<void> {
  const aid = await requirePermissionAction('access.manage');

  const attachmentId = parseStr(formData.get('attachmentId'));
  if (!attachmentId) return;

  await withActor(aid, (tx) =>
    tx.execute(sql`
      DELETE FROM attachments
      WHERE id = ${attachmentId}::uuid
        AND entity_type = ${COMPANY_ASSET_ENTITY}
    `),
  );
  revalidatePath('/assets');
}
