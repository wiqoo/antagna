// Shared (non-server) constants for the stage-task-template builder. Imported by
// the server actions, the server page, and the client island — must NOT carry a
// 'use server' / 'use client' directive.

// Mirror of project_stage pg enum (projects.ts). Only the stages where a task
// checklist actually makes sense are surfaced as builder tabs; lead/lost/etc.
// are excluded from the per-stage builder but kept here for label lookups.
export const TEMPLATE_STAGES = [
  'brief',
  'quoted',
  'approved',
  'planning',
  'shooting',
  'editing',
  'review',
  'delivered',
] as const;

export type TemplateStage = (typeof TEMPLATE_STAGES)[number];

export const STAGE_LABEL_AR: Record<string, string> = {
  lead: 'فرصة',
  brief: 'البريف',
  quoted: 'التسعير',
  approved: 'معتمد',
  planning: 'التخطيط',
  shooting: 'التصوير',
  editing: 'المونتاج',
  review: 'المراجعة',
  delivered: 'التسليم',
  archived: 'مؤرشف',
  lost: 'خسارة',
  cancelled: 'ملغي',
};

// Mirror of project_assignment_role pg enum (projects.ts).
export const ASSIGNEE_ROLES = [
  'account_manager',
  'project_manager',
  'production_manager',
  'shooter_lead',
  'shooter',
  'editor_lead',
  'editor',
  'colorist',
  'sound_engineer',
  'drone_pilot',
  'talent',
  'stylist',
  'makeup',
  'art_director',
  'production_assistant',
  'freelancer_other',
] as const;

export const ROLE_LABEL_AR: Record<string, string> = {
  account_manager: 'مدير حساب',
  project_manager: 'مدير مشروع',
  production_manager: 'مدير إنتاج',
  shooter_lead: 'رئيس تصوير',
  shooter: 'مصوّر',
  editor_lead: 'رئيس مونتاج',
  editor: 'مونتير',
  colorist: 'كولرست',
  sound_engineer: 'مهندس صوت',
  drone_pilot: 'طيّار درون',
  talent: 'تالنت',
  stylist: 'ستايلست',
  makeup: 'مكياج',
  art_director: 'مدير فني',
  production_assistant: 'مساعد إنتاج',
  freelancer_other: 'فريلانسر / أخرى',
};
