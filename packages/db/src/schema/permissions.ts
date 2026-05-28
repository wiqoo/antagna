/**
 * Pillar 3 — Identity & Permissions.
 *
 * The three tables that make `has_permission(profile_id, key)` work:
 *   - permissions: catalog of every permission key in the system
 *   - position_default_permissions: which keys each position gets by default
 *     (renamed from role_default_permissions in migration 049 — D-037/D-041)
 *   - user_permission_overrides: per-user grant/deny with optional expiry
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';

export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  category: text('category').notNull(),
  descriptionAr: text('description_ar'),
  descriptionEn: text('description_en'),
  riskLevel: text('risk_level').notNull().default('normal'), // 'low' | 'normal' | 'high'
});

export const positionDefaultPermissions = pgTable(
  'position_default_permissions',
  {
    positionKey: text('position_key').notNull(),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key),
  },
  (t) => [primaryKey({ columns: [t.positionKey, t.permissionKey] })],
);

export const userPermissionOverrides = pgTable(
  'user_permission_overrides',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key),
    granted: boolean('granted').notNull(), // true = grant, false = explicit deny
    reason: text('reason'),
    grantedBy: uuid('granted_by').references(() => profiles.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.permissionKey] })],
);

export type Permission = typeof permissions.$inferSelect;
export type PositionDefaultPermission = typeof positionDefaultPermissions.$inferSelect;
export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
