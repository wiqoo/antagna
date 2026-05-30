'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { sendText } from '@/lib/whatsapp';
import { writeActivity } from '@/lib/activity';

/** Send a WhatsApp message from the team line + persist it as an outbound row. */
export async function sendWhatsappMessage(
  threadKey: string,
  toE164: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'الرسالة فارغة' };
  if (!toE164.startsWith('+')) {
    return { ok: false, error: 'لا يوجد رقم صالح لهذه المحادثة (LID غير محلول).' };
  }

  const actorId = await requirePermissionAction('whatsapp.send');

  const res = await sendText(toE164, trimmed);
  if (!res.ok) return { ok: false, error: 'تعذّر الإرسال عبر WhatsApp' };

  const ourE164 = process.env.WHATSAPP_OUR_E164 ?? 'unknown';
  await withActor(actorId, (tx) =>
    tx.execute(sql`
      INSERT INTO whatsapp_messages
        (baileys_message_id, direction, from_e164, to_e164, message_type, body_text,
         thread_key, received_at, matched_profile_id)
      VALUES (
        ${res.messageId ?? null}, 'outbound', ${ourE164}, ${toE164}, 'text', ${trimmed},
        ${threadKey}, now(), ${actorId}::uuid
      )
      ON CONFLICT (baileys_message_id) DO NOTHING
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'whatsapp',
    action: 'whatsapp_sent',
    summaryAr: `رسالة WhatsApp إلى ${toE164}: ${trimmed.slice(0, 80)}`,
    summaryEn: `WhatsApp sent to ${toE164}`,
    metadata: { thread_key: threadKey },
  });

  revalidatePath(`/whatsapp/${encodeURIComponent(threadKey)}`);
  revalidatePath('/whatsapp');
  return { ok: true };
}

/** B4: spin up a project_task straight from a WhatsApp thread so the request
 *  doesn't get lost in the conversation. Anchors the source thread in the
 *  description for traceability. */
export async function createTaskFromThread(
  threadKey: string,
  formData: FormData,
): Promise<void> {
  const actorId = await requirePermissionAction('project.update');

  const projectId = formData.get('projectId')?.toString();
  const title = formData.get('title')?.toString().trim();
  const priority = formData.get('priority')?.toString() || 'normal';
  const dueAt = formData.get('dueAt')?.toString() || null;
  if (!projectId || !title) return;

  // Pull the last inbound message of this thread for context (shown in the
  // task's description, with a deep-link back).
  const lastInbound = (await db.execute(sql`
    SELECT body_text AS "bodyText"
    FROM whatsapp_messages
    WHERE thread_key = ${threadKey} AND direction = 'inbound'
    ORDER BY received_at DESC LIMIT 1
  `)) as unknown as Array<{ bodyText: string | null }>;
  const snippet = lastInbound[0]?.bodyText?.slice(0, 280) ?? '';

  const description =
    `أُنشئت من محادثة WhatsApp.\n` +
    `الرابط: /whatsapp/${encodeURIComponent(threadKey)}\n` +
    (snippet ? `\nآخر رسالة:\n${snippet}` : '');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      INSERT INTO project_tasks
        (project_id, title, description, status, priority, due_at, created_by)
      VALUES (
        ${projectId}::uuid, ${title}, ${description},
        'pending', ${priority}::task_priority,
        ${dueAt ? sql`${dueAt}::timestamptz` : sql`NULL`},
        ${actorId}::uuid
      )
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'project_task',
    action: 'task_created_from_whatsapp',
    summaryAr: `مهمة جديدة من WhatsApp: ${title}`,
    summaryEn: `New task from WhatsApp: ${title}`,
    projectId,
    metadata: { thread_key: threadKey },
  });

  revalidatePath(`/whatsapp/${encodeURIComponent(threadKey)}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/board`);
}
