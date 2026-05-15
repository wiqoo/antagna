import { z } from 'zod';

/**
 * System-level roles. Determined by Pillar 3 (Identity & Permissions).
 * Pillar 16 §A canonical roster maps each person to exactly one of these.
 */
export const SystemRole = z.enum([
  'system_admin',
  'general_manager',
  'project_manager',
  'account_manager',
  'hr',
  'finance',
  'user',
]);

export type SystemRole = z.infer<typeof SystemRole>;

/**
 * Capabilities (the "multi-hat" model from Pillar 16 §A).
 * A user can hold many capabilities regardless of role.
 */
export const Capability = z.enum([
  'production_manager',
  'project_manager',
  'account_manager',
  'shooter',
  'editor',
  'director',
  'talent',
  'approver',
  'ai_specialist',
  'equipment_manager',
  'procurement',
  'hr',
  'accounting',
  'trainee',
]);

export type Capability = z.infer<typeof Capability>;
