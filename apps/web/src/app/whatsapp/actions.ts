'use server';

import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
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

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'انتهت الجلسة' };
  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  const res = await sendText(toE164, trimmed);
  if (!res.ok) return { ok: false, error: 'تعذّر الإرسال عبر WhatsApp' };

  const ourE164 = process.env.WHATSAPP_OUR_E164 ?? 'unknown';
  await db.execute(sql`
    INSERT INTO whatsapp_messages
      (baileys_message_id, direction, from_e164, to_e164, message_type, body_text,
       thread_key, received_at, matched_profile_id)
    VALUES (
      ${res.messageId ?? null}, 'outbound', ${ourE164}, ${toE164}, 'text', ${trimmed},
      ${threadKey}, now(), ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
    )
    ON CONFLICT (baileys_message_id) DO NOTHING
  `);

  await writeActivity({
    actorId: actor?.id ?? null,
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
