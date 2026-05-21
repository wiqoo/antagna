/**
 * Google Drive — folder management for Antagna projects.
 *
 * Uses the same single-account OAuth identity (info@voltsaudi.com) we
 * already wired in lib/google.ts. Folders are created in the authorizing
 * account's "My Drive" for now; switching to a Shared Drive later is a
 * one-line change in `findOrCreateRoot`.
 *
 * Standard structure (per Pillar 13 §I):
 *   /Antagna Projects/{year}/{client-code}/{project-code} - {title}/
 *     ├─ 01 Brief
 *     ├─ 02 Pre-Production
 *     ├─ 03 Footage
 *     ├─ 04 Edits
 *     └─ 05 Deliverables
 */
import { getDriveClient } from './google';
import { SYSTEM_MAILBOX } from './gmail-ingest';

const ROOT_FOLDER_NAME = 'Antagna Projects';
const STANDARD_SUBFOLDERS = [
  '01 Brief',
  '02 Pre-Production',
  '03 Footage',
  '04 Edits',
  '05 Deliverables',
];

export interface ProjectFolderInput {
  projectCode: string;        // e.g. PRJ-0007
  projectTitle: string;       // e.g. فيلم العلامة التجارية
  clientCode: string | null;  // e.g. BMW or null
  year: number;               // 2026
}

export interface ProjectFolderResult {
  rootFolderId: string;
  projectFolderId: string;
  projectFolderUrl: string;
  subfolders: { name: string; id: string }[];
}

/**
 * Create the full folder tree for a project. Idempotent: re-running for the
 * same project finds existing folders by name in the same parent and reuses
 * them rather than duplicating.
 */
export async function ensureProjectFolderTree(
  input: ProjectFolderInput,
): Promise<ProjectFolderResult> {
  const drive = await getDriveClient(SYSTEM_MAILBOX);

  const rootId = await findOrCreate(drive, ROOT_FOLDER_NAME, null);
  const yearId = await findOrCreate(drive, String(input.year), rootId);
  const clientFolderName = input.clientCode ?? 'Unassigned';
  const clientId = await findOrCreate(drive, clientFolderName, yearId);

  const projectFolderName =
    `${input.projectCode} - ${input.projectTitle}`.slice(0, 200);
  const projectId = await findOrCreate(drive, projectFolderName, clientId);

  const subfolders: { name: string; id: string }[] = [];
  for (const sub of STANDARD_SUBFOLDERS) {
    const id = await findOrCreate(drive, sub, projectId);
    subfolders.push({ name: sub, id });
  }

  return {
    rootFolderId: rootId,
    projectFolderId: projectId,
    projectFolderUrl: `https://drive.google.com/drive/folders/${projectId}`,
    subfolders,
  };
}

/**
 * Find a folder by name within a parent (or in the root if parent is null),
 * or create it if absent. Returns its id.
 */
async function findOrCreate(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  name: string,
  parentId: string | null,
): Promise<string> {
  const escapedName = name.replace(/'/g, "\\'");
  const q =
    `mimeType = 'application/vnd.google-apps.folder' ` +
    `and trashed = false ` +
    `and name = '${escapedName}'` +
    (parentId ? ` and '${parentId}' in parents` : '');

  const res = await drive.files.list({
    q,
    fields: 'files(id, name)',
    pageSize: 1,
    spaces: 'drive',
  });
  const found = res.data.files?.[0];
  if (found?.id) return found.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  });
  if (!created.data.id) {
    throw new Error(`failed to create folder "${name}"`);
  }
  return created.data.id;
}
