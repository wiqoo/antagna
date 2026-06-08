import { pgTable, text, jsonb, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;

/**
 * Persistent translation cache — the shared warm store for the whole i18n
 * engine. A row is keyed by (source hash, target language, domain). It is BOTH
 * the runtime-layer cache and, for domain='ui', effectively the reviewed
 * dictionary (status='reviewed' marks a human-checked premium string).
 */
export const translationCache = pgTable(
  'translation_cache',
  {
    sourceSha256: text('source_sha256').notNull(),
    sourceLang: text('source_lang').notNull().default('ar'),
    targetLang: text('target_lang').notNull(),
    // 'ui' | 'content' | 'name' | 'email' — drives prompt + review policy.
    domain: text('domain').notNull().default('ui'),
    sourceText: text('source_text').notNull(),
    translatedText: text('translated_text').notNull(),
    // 'machine' (auto) | 'reviewed' (human-edited, never overwritten by machine)
    status: text('status').notNull().default('machine'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sourceSha256, t.targetLang, t.domain] }),
  }),
);

export type TranslationCacheRow = typeof translationCache.$inferSelect;
export type NewTranslationCacheRow = typeof translationCache.$inferInsert;
