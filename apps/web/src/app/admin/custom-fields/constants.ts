// Shared (non-server) constants for the custom-field builder. Imported by the
// server actions, the server page, and the client island — so it must NOT carry
// a 'use server' / 'use client' directive.

// Entity types a custom field can attach to. Mirrors the polymorphic
// entity_type strings used across attachments / tags / custom_field_values.
export const CF_ENTITY_TYPES = [
  'project',
  'client',
  'contact',
  'lead',
  'equipment',
  'profile',
  'social_account',
] as const;

export type EntityType = (typeof CF_ENTITY_TYPES)[number];

// Mirror of the custom_field_type pg enum (cross_cutting.ts).
export const CF_FIELD_TYPES = [
  'text',
  'long_text',
  'number',
  'currency',
  'date',
  'datetime',
  'boolean',
  'select',
  'multi_select',
  'url',
  'user_ref',
  'client_ref',
  'project_ref',
] as const;

export type FieldType = (typeof CF_FIELD_TYPES)[number];

export const ENTITY_LABEL_AR: Record<string, string> = {
  project: 'المشاريع',
  client: 'العملاء',
  contact: 'جهات الاتصال',
  lead: 'الفرص (Leads)',
  equipment: 'المعدات',
  profile: 'الأعضاء',
  social_account: 'حسابات السوشيال',
};

export const FIELD_TYPE_LABEL_AR: Record<string, string> = {
  text: 'نص قصير',
  long_text: 'نص طويل',
  number: 'رقم',
  currency: 'مبلغ مالي',
  date: 'تاريخ',
  datetime: 'تاريخ ووقت',
  boolean: 'نعم/لا',
  select: 'اختيار واحد',
  multi_select: 'اختيار متعدّد',
  url: 'رابط',
  user_ref: 'إشارة لعضو',
  client_ref: 'إشارة لعميل',
  project_ref: 'إشارة لمشروع',
};

/** Field types whose `options.choices` are meaningful. */
export const TYPES_WITH_OPTIONS = new Set<string>(['select', 'multi_select']);

/** Render an options jsonb back to the "value | label" textarea format. */
export function optionsToText(options: unknown): string {
  if (!options || typeof options !== 'object') return '';
  const choices = (options as { choices?: { value: string; label?: string }[] }).choices;
  if (!Array.isArray(choices)) return '';
  return choices
    .map((c) => (c.label && c.label !== c.value ? `${c.value} | ${c.label}` : c.value))
    .join('\n');
}
