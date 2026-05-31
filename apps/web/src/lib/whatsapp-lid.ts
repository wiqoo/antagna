/**
 * LID thread reconciliation.
 *
 * WhatsApp's privacy `@lid` addressing can produce TWO threads for one person:
 * a `lid:NNN`-keyed one (number hidden) and a `+E164`-keyed one (number known).
 * `whatsapp_messages.thread_key` is the only thing that defines a thread, so the
 * fix is: resolve the LID to its real number (via the session's contact store),
 * then rewrite every `lid:NNN` row onto the phone key — collapsing the two
 * halves into one conversation and unblocking replies.
 */
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { resolveLidToPhone } from './whatsapp';

/**
 * Resolve `lid` (bare digits or `lid:NNN`) to a phone number and MERGE: rekey
 * its messages onto the `+E164` thread + remember the mapping on a matching
 * profile. Idempotent. Returns the resolved phone, or null when it can't be
 * resolved (unsaved + privacy-hidden) — caller decides what to surface.
 */
export async function resolveAndMergeLid(
  lid: string,
): Promise<{ phone: string; merged: number } | null> {
  const digits = lid.replace(/[^0-9]/g, '');
  if (!digits) return null;

  const phone = await resolveLidToPhone(digits);
  if (!phone) return null;

  const lidKey = `lid:${digits}`;

  // Collapse the lid-keyed thread into the phone-keyed one. Rewrites the thread
  // key on every row + swaps the lid placeholder in from/to so inbound shows the
  // real sender and outbound (if any landed under the lid key) lines up.
  let merged = 0;
  try {
    const r = (await db.execute(sql`
      UPDATE whatsapp_messages
      SET thread_key = ${phone},
          from_e164 = CASE WHEN from_e164 = ${lidKey} THEN ${phone} ELSE from_e164 END,
          to_e164   = CASE WHEN to_e164   = ${lidKey} THEN ${phone} ELSE to_e164   END
      WHERE thread_key = ${lidKey}
    `)) as unknown as { rowCount?: number };
    merged = r?.rowCount ?? 0;
  } catch (e) {
    console.error('[whatsapp-lid] merge failed', e);
  }

  // Learn the mapping so future @lid messages from this person resolve instantly
  // (and the bot can identify them).
  try {
    await db.execute(sql`
      UPDATE profiles SET whatsapp_lid = ${digits}, updated_at = now()
      WHERE whatsapp_e164 = ${phone}
        AND (whatsapp_lid IS NULL OR whatsapp_lid <> ${digits})
    `);
  } catch (e) {
    console.error('[whatsapp-lid] profile map failed', e);
  }

  return { phone, merged };
}
