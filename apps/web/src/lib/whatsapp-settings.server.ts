/**
 * Server-only reader for the WhatsApp bot settings (keeps the DB import out of
 * the client bundle — the constants/types live in whatsapp-settings.ts).
 */
import { db } from '@antagna/db';
import { sql } from 'drizzle-orm';
import { WHATSAPP_DEFAULTS, type WhatsappSettings } from './whatsapp-settings';

export async function getWhatsappSettings(): Promise<WhatsappSettings> {
  try {
    const r = (await db.execute(
      sql`SELECT value FROM system_settings WHERE key = 'whatsapp_bot' LIMIT 1`,
    )) as unknown as Array<{ value: Partial<WhatsappSettings> | null }>;
    const v = (r[0]?.value ?? {}) as Partial<WhatsappSettings>;
    return {
      ...WHATSAPP_DEFAULTS,
      ...v,
      tools: { ...WHATSAPP_DEFAULTS.tools, ...(v.tools ?? {}) },
      allowedPositions:
        Array.isArray(v.allowedPositions) && v.allowedPositions.length
          ? v.allowedPositions.map(String)
          : ['*'],
    };
  } catch {
    return WHATSAPP_DEFAULTS;
  }
}
