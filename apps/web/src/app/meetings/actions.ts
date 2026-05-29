'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';
import { parseDate, parseStr } from '@/lib/parse';

// Meetings live in `meeting_notes` (real columns: source, source_id,
// meeting_title, meeting_date, attendees_text, note_content, drive_url,
// project_id, client_id, ai_action_items jsonb, created_at). There is no
// created_by / updated_at column — we keep all writes inside withActor so the
// audit trigger still sees the acting principal. Create/edit gate on
// `project.update` (closest existing operational key; a meeting is a project /
// client touch-point, not a standalone resource with its own key).

const MEETING_KEY = 'project.update';

function uuidOrNull(raw: FormDataEntryValue | null | undefined): string | null {
  const s = parseStr(raw);
  if (!s) return null;
  // Defensive: only accept a UUID-shaped value, otherwise drop to NULL so a
  // stray empty-select value can't blow up the ::uuid cast.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    ? s
    : null;
}

export async function createMeeting(formData: FormData) {
  const actorId = await requirePermissionAction(MEETING_KEY);

  const title = parseStr(formData.get('meetingTitle'));
  const meetingDate = parseDate(formData.get('meetingDate'));
  const attendeesText = parseStr(formData.get('attendeesText'));
  const noteContent = parseStr(formData.get('noteContent'));
  const driveUrl = parseStr(formData.get('driveUrl'));
  const projectId = uuidOrNull(formData.get('projectId'));
  const clientId = uuidOrNull(formData.get('clientId'));

  if (!title) throw new Error('meetingTitle required');

  // Action items come in as one-per-line textarea → store as a jsonb array of
  // { text, done } so the detail page can render a checklist.
  const actionItemsRaw = formData.get('actionItems')?.toString() ?? '';
  const actionItems = actionItemsRaw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((text) => ({ text: text.slice(0, 500), done: false }));

  const newId = await withActor(actorId, async (tx) => {
    const res = await tx.execute<{ id: string }>(sql`
      INSERT INTO meeting_notes (
        source, meeting_title, meeting_date, attendees_text, note_content,
        drive_url, project_id, client_id, ai_action_items
      ) VALUES (
        'manual', ${title},
        ${meetingDate ? sql`${meetingDate}::timestamptz` : sql`now()`},
        ${attendeesText}, ${noteContent}, ${driveUrl},
        ${projectId ? sql`${projectId}::uuid` : sql`NULL`},
        ${clientId ? sql`${clientId}::uuid` : sql`NULL`},
        ${actionItems.length > 0 ? sql`${JSON.stringify(actionItems)}::jsonb` : sql`NULL`}
      )
      RETURNING id::text AS id
    `);
    return (res as unknown as Array<{ id: string }>)[0]?.id ?? '';
  });

  if (!newId) throw new Error('meeting insert failed');

  await writeActivity({
    actorId,
    entityType: 'meeting_note',
    entityId: newId,
    projectId: projectId ?? undefined,
    action: 'meeting_created',
    summaryAr: `سُجِّل محضر اجتماع: ${title}`,
    summaryEn: `Meeting note created: ${title}`,
  });

  revalidatePath('/meetings');
  redirect(`/meetings/${newId}`);
}

export async function updateMeeting(meetingId: string, formData: FormData) {
  const actorId = await requirePermissionAction(MEETING_KEY);

  const title = parseStr(formData.get('meetingTitle'));
  const meetingDate = parseDate(formData.get('meetingDate'));
  const attendeesText = parseStr(formData.get('attendeesText'));
  const noteContent = parseStr(formData.get('noteContent'));
  const driveUrl = parseStr(formData.get('driveUrl'));
  const projectId = uuidOrNull(formData.get('projectId'));
  const clientId = uuidOrNull(formData.get('clientId'));

  if (!title) throw new Error('meetingTitle required');

  const actionItemsRaw = formData.get('actionItems')?.toString() ?? '';
  const actionItems = actionItemsRaw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((text) => ({ text: text.slice(0, 500), done: false }));

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE meeting_notes SET
        meeting_title = ${title},
        meeting_date = ${meetingDate ? sql`${meetingDate}::timestamptz` : sql`meeting_date`},
        attendees_text = ${attendeesText},
        note_content = ${noteContent},
        drive_url = ${driveUrl},
        project_id = ${projectId ? sql`${projectId}::uuid` : sql`NULL`},
        client_id = ${clientId ? sql`${clientId}::uuid` : sql`NULL`},
        ai_action_items = ${actionItems.length > 0 ? sql`${JSON.stringify(actionItems)}::jsonb` : sql`NULL`}
      WHERE id = ${meetingId}::uuid
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'meeting_note',
    entityId: meetingId,
    projectId: projectId ?? undefined,
    action: 'meeting_updated',
    summaryAr: `حُدِّث محضر اجتماع: ${title}`,
    summaryEn: `Meeting note updated: ${title}`,
  });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath('/meetings');
  redirect(`/meetings/${meetingId}`);
}

/** Toggle a single action item's done flag (detail-page checklist). */
export async function toggleMeetingActionItem(meetingId: string, index: number) {
  const actorId = await requirePermissionAction(MEETING_KEY);

  await withActor(actorId, async (tx) => {
    const res = await tx.execute<{ items: unknown }>(sql`
      SELECT ai_action_items AS items FROM meeting_notes WHERE id = ${meetingId}::uuid LIMIT 1
    `);
    const raw = (res as unknown as Array<{ items: unknown }>)[0]?.items;
    const items = Array.isArray(raw) ? (raw as Array<{ text?: string; done?: boolean }>) : [];
    if (index < 0 || index >= items.length) return;
    const current = items[index];
    items[index] = { text: String(current?.text ?? ''), done: !current?.done };
    await tx.execute(sql`
      UPDATE meeting_notes SET ai_action_items = ${JSON.stringify(items)}::jsonb
      WHERE id = ${meetingId}::uuid
    `);
  });

  revalidatePath(`/meetings/${meetingId}`);
}

export async function deleteMeeting(meetingId: string) {
  const actorId = await requirePermissionAction(MEETING_KEY);
  await withActor(actorId, (tx) =>
    tx.execute(sql`DELETE FROM meeting_notes WHERE id = ${meetingId}::uuid`),
  );
  await writeActivity({
    actorId,
    entityType: 'meeting_note',
    entityId: meetingId,
    action: 'meeting_deleted',
    summaryAr: 'حُذِف محضر اجتماع',
    summaryEn: 'Meeting note deleted',
  });
  revalidatePath('/meetings');
  redirect('/meetings');
}
