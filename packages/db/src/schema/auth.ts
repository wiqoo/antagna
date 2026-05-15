import { pgTable, uuid, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Roles are loose strings at the SQL level so Pillar 3 can extend without a migration storm.
// Application code validates against the enum in @antagna/shared.
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: uuid('auth_user_id').unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  fullNameAr: text('full_name_ar'),
  role: text('role').notNull().default('user'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
