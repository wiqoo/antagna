'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { markChunkUseful } from '@antagna/ai';
import { requirePermissionAction } from '@/lib/authz';
import { sendText } from '@/lib/whatsapp';
import { WHATSAPP_DEFAULTS, type WhatsappSettings } from '@/lib/whatsapp-settings';

const PATH = '/admin/system';

/* ─────────────────────────── (a) Keys & tokens ─────────────────────────── */

export async function revokeToken(id: string) {
  await requirePermissionAction('integration.manage');
  await db.execute(sql`
    UPDATE oauth_tokens
    SET revoked = true, updated_at = now()
    WHERE id = ${id}::uuid
  `);
  revalidatePath(PATH);
}

/* ───────────────────────────── (b) AI Cost Guard ───────────────────────── */

export async function upsertUserLimit(input: {
  userId: string;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  hardCap: boolean;
}) {
  await requirePermissionAction('ai.manage');
  const daily = Number.isFinite(input.dailyLimitUsd) ? input.dailyLimitUsd : 2;
  const monthly = Number.isFinite(input.monthlyLimitUsd) ? input.monthlyLimitUsd : 30;
  await db.execute(sql`
    INSERT INTO ai_user_limits (user_id, daily_limit_usd, monthly_limit_usd, hard_cap, updated_at)
    VALUES (${input.userId}::uuid, ${daily}, ${monthly}, ${input.hardCap}, now())
    ON CONFLICT (user_id) DO UPDATE
      SET daily_limit_usd = EXCLUDED.daily_limit_usd,
          monthly_limit_usd = EXCLUDED.monthly_limit_usd,
          hard_cap = EXCLUDED.hard_cap,
          updated_at = now()
  `);
  revalidatePath(PATH);
}

export async function setMonthlyBudget(budgetUsd: number) {
  await requirePermissionAction('ai.manage');
  const value = Number.isFinite(budgetUsd) && budgetUsd >= 0 ? budgetUsd : 0;
  await writeSetting('ai.monthly_budget_usd', value);
  revalidatePath(PATH);
}

/* ──────────────────────────── (c) Email integration ────────────────────── */

export async function setInboundEmailEnabled(enabled: boolean) {
  await requirePermissionAction('integration.manage');
  await writeSetting('email.inbound_enabled', enabled);
  revalidatePath(PATH);
}

/* ──────────────────────────────── (d) Brain ────────────────────────────── */

export async function markUseful(id: string, useful: boolean) {
  await requirePermissionAction('memory.manage');
  await markChunkUseful(id, useful);
  revalidatePath(PATH);
}

/** Delete chunks that were never retrieved AND are older than 30 days. */
export async function pruneLowRelevance() {
  await requirePermissionAction('memory.manage');
  const res = (await db.execute(sql`
    WITH del AS (
      DELETE FROM ai_memory_chunks
      WHERE retrieval_count = 0 AND created_at < now() - interval '30 days'
      RETURNING 1
    )
    SELECT count(*)::int AS pruned FROM del
  `)) as unknown as { pruned: number }[];
  revalidatePath(PATH);
  return res[0]?.pruned ?? 0;
}

/** Worker-deferred reindex: just stamp the request — the worker picks it up. */
export async function requestReindex() {
  await requirePermissionAction('memory.manage');
  await writeSetting('memory.reindex_requested_at', new Date().toISOString());
  revalidatePath(PATH);
}

/* ─────────────────────────── (e) System settings ───────────────────────── */

export async function upsertSetting(key: string, rawJson: string) {
  await requirePermissionAction('settings.update');
  const trimmedKey = key.trim();
  if (!trimmedKey) throw new Error('المفتاح مطلوب');
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('القيمة ليست JSON صالحًا');
  }
  await writeSetting(trimmedKey, parsed);
  revalidatePath(PATH);
}

/* ──────────────────────── (f) Subscriptions & cron ─────────────────────── */

export interface Subscription {
  vendor: string;
  plan: string;
  renews_at: string | null;
  cost_usd: number;
}

export async function setSubscriptions(subs: Subscription[]) {
  await requirePermissionAction('settings.update');
  const clean = subs
    .filter((s) => s.vendor?.trim())
    .map((s) => ({
      vendor: String(s.vendor).trim(),
      plan: String(s.plan ?? '').trim(),
      renews_at: s.renews_at?.trim() ? s.renews_at.trim() : null,
      cost_usd: Number.isFinite(Number(s.cost_usd)) ? Number(s.cost_usd) : 0,
    }));
  await writeSetting('subscriptions', clean);
  revalidatePath(PATH);
}

/* ──────────────────────────── (g) WhatsApp bot ─────────────────────────── */

export async function saveWhatsappSettings(input: WhatsappSettings) {
  await requirePermissionAction('integration.manage');
  const modes = ['auto', 'draft', 'off'] as const;
  const clean: WhatsappSettings = {
    enabled: !!input.enabled,
    replyMode: modes.includes(input.replyMode) ? input.replyMode : 'auto',
    allowedPositions:
      Array.isArray(input.allowedPositions) && input.allowedPositions.length
        ? input.allowedPositions.map(String)
        : ['*'],
    persona: String(input.persona ?? '').slice(0, 2000),
    tools:
      input.tools && typeof input.tools === 'object'
        ? Object.fromEntries(Object.entries(input.tools).map(([k, v]) => [k, !!v]))
        : WHATSAPP_DEFAULTS.tools,
    provider: input.provider === 'anthropic' ? 'anthropic' : 'openai',
    model: String(input.model ?? WHATSAPP_DEFAULTS.model).slice(0, 80) || WHATSAPP_DEFAULTS.model,
    maxTokens: Number.isFinite(input.maxTokens)
      ? Math.min(2000, Math.max(100, Math.round(input.maxTokens)))
      : 400,
  };
  await writeSetting('whatsapp_bot', clean);
  revalidatePath(PATH);
}

/** Send a one-off WhatsApp from the production bridge (diagnostic / test). */
export async function sendTestWhatsapp(
  to: string,
  body: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  await requirePermissionAction('integration.manage');
  if (!to?.trim() || !body?.trim()) return { ok: false, error: 'الرقم والنص مطلوبان' };
  try {
    const res = await sendText(to.trim(), body.trim());
    return res.ok
      ? { ok: true, messageId: res.messageId }
      : { ok: false, error: 'فشل الإرسال — راجِع اتصال البريدج (التَنَل/الجلسة)' };
  } catch (e) {
    return { ok: false, error: (e as { message?: string })?.message ?? 'خطأ غير معروف' };
  }
}

/* ───────────────────────────────── helper ──────────────────────────────── */

/** Upsert a system_settings row. value is serialized to jsonb. */
async function writeSetting(key: string, value: unknown) {
  await db.execute(sql`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()
  `);
}
