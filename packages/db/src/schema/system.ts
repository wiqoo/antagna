import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
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
