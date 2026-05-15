import { pgTable, bigserial, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './auth';

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    actorId: uuid('actor_id').references(() => profiles.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    summary: text('summary'),
    beforeData: jsonb('before_data'),
    afterData: jsonb('after_data'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_actor_idx').on(t.actorId),
    index('audit_log_created_at_idx').on(t.createdAt),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
