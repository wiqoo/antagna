'use server';

import { revalidatePath } from 'next/cache';
import { db, profiles } from '@antagna/db';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 min

async function getMyProfileId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Generate a fresh 2-digit verification code unique among CURRENTLY active
 * (non-expired) codes. Stores it on the caller's profile + returns it.
 *
 * REQUIRES the user's E.164 phone number — WPPConnect can't reply to LIDs,
 * so we need the real phone to send outgoing messages.
 */
export async function generateMyWhatsappCode(phoneE164: string): Promise<{
  ok: boolean;
  code?: string;
  expiresAtIso?: string;
  error?: string;
}> {
  const id = await getMyProfileId();
  if (!id) return { ok: false, error: 'unauthorized' };

  // Validate phone number format (E.164: +, country code, 6-15 digits)
  const normalized = phoneE164.trim().replace(/\s+/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
    return { ok: false, error: 'phone_invalid' };
  }

  // Pull the set of active codes so we avoid a collision.
  const used = await db.execute<{ code: string }>(sql`
    SELECT whatsapp_verification_code AS code
    FROM profiles
    WHERE whatsapp_verification_code IS NOT NULL
      AND whatsapp_verification_expires_at > now()
      AND id <> ${id}::uuid
  `);
  const usedSet = new Set(
    (used as unknown as { code: string }[]).map((r) => r.code),
  );

  let code: string | null = null;
  for (let i = 0; i < 200; i++) {
    const candidate = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    if (!usedSet.has(candidate)) {
      code = candidate;
      break;
    }
  }
  if (!code) return { ok: false, error: 'no_free_code' };

  const expires = new Date(Date.now() + CODE_TTL_MS);
  await db
    .update(profiles)
    .set({
      whatsappE164: normalized,            // the real phone for outbound sends
      whatsappLid: null,                   // wipe any previous LID
      whatsappVerificationCode: code,
      whatsappVerificationExpiresAt: expires,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, id));

  revalidatePath('/settings/whatsapp');
  return { ok: true, code, expiresAtIso: expires.toISOString() };
}

/**
 * Clear the verification code (cancel pending link).
 */
export async function cancelMyWhatsappCode(): Promise<void> {
  const id = await getMyProfileId();
  if (!id) return;
  await db
    .update(profiles)
    .set({
      whatsappVerificationCode: null,
      whatsappVerificationExpiresAt: null,
    })
    .where(eq(profiles.id, id));
  revalidatePath('/settings/whatsapp');
}

/**
 * Disconnect a previously linked WhatsApp identity.
 */
export async function unlinkMyWhatsapp(): Promise<void> {
  const id = await getMyProfileId();
  if (!id) return;
  await db
    .update(profiles)
    .set({ whatsappE164: null, whatsappLid: null })
    .where(eq(profiles.id, id));
  revalidatePath('/settings/whatsapp');
}
