/**
 * Pillar 11 — Automation & Alerts Engine.
 *
 * Declarative alert_rules + alert_fires audit. The scanner (Trigger.dev task,
 * Pillar 13 territory) reads alert_rules every 5 minutes and writes alert_fires
 * + notifications.
 */
import {
  pgTable,
  uuid,
  bigserial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';
import { notificationEventTypes } from './cross_cutting';

export const alertRuleTriggerTypeEnum = pgEnum('alert_rule_trigger_type', [
  'schedule',
  'event',
  'threshold',
]);

export const alertRules = pgTable('alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  description: text('description'),

  triggerType: alertRuleTriggerTypeEnum('trigger_type').notNull(),
  triggerSpec: jsonb('trigger_spec').notNull(),

  notificationEventKey: text('notification_event_key').references(() => notificationEventTypes.key),
  recipientStrategy: text('recipient_strategy').notNull(),

  escalationChain: jsonb('escalation_chain'),
  autoAction: jsonb('auto_action'),

  cooldownMinutes: integer('cooldown_minutes').notNull().default(60),

  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const alertFires = pgTable(
  'alert_fires',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    ruleKey: text('rule_key')
      .notNull()
      .references(() => alertRules.key),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),

    notifiedProfileIds: uuid('notified_profile_ids').array(),
    escalationStep: integer('escalation_step').notNull().default(0),

    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedById: uuid('acknowledged_by_id').references(() => profiles.id),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),

    autoActionTaken: text('auto_action_taken'),
    autoActionRefId: uuid('auto_action_ref_id'),

    metadata: jsonb('metadata'),
    firedAt: timestamp('fired_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('fires_by_entity').on(t.entityType, t.entityId, t.firedAt.desc()),
    index('fires_by_rule').on(t.ruleKey, t.firedAt.desc()),
  ],
);

export type AlertRule = typeof alertRules.$inferSelect;
export type AlertFire = typeof alertFires.$inferSelect;
