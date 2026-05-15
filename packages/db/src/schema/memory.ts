import {
  pgTable,
  bigserial,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  vector,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './auth';

// ai_usage — append-only cost ledger
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    feature: text('feature').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    projectId: uuid('project_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('ai_usage_user_idx').on(t.userId),
    index('ai_usage_feature_idx').on(t.feature),
    index('ai_usage_created_at_idx').on(t.createdAt),
  ],
);

// ai_user_limits — soft caps per user
export const aiUserLimits = pgTable('ai_user_limits', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  dailyLimitUsd: numeric('daily_limit_usd', { precision: 10, scale: 4 })
    .notNull()
    .default('2.0'),
  monthlyLimitUsd: numeric('monthly_limit_usd', { precision: 10, scale: 4 })
    .notNull()
    .default('30.0'),
  hardCap: boolean('hard_cap').notNull().default(false),
  notes: text('notes'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ai_memory_chunks — pgvector-backed retrieval
export const aiMemoryChunks = pgTable(
  'ai_memory_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: text('scope').notNull(),
    scopeId: uuid('scope_id'),
    source: text('source').notNull(),
    sourceId: text('source_id'),
    content: text('content').notNull(),
    contentLang: text('content_lang'),
    embedding: vector('embedding', { dimensions: 1536 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('ai_memory_chunks_scope_idx').on(t.scope, t.scopeId),
    index('ai_memory_chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

export type AiUsageRow = typeof aiUsage.$inferSelect;
export type NewAiUsageRow = typeof aiUsage.$inferInsert;
export type AiUserLimit = typeof aiUserLimits.$inferSelect;
export type AiMemoryChunk = typeof aiMemoryChunks.$inferSelect;
export type NewAiMemoryChunk = typeof aiMemoryChunks.$inferInsert;
