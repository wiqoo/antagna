import type { ComponentProps } from 'react';
import type { StatusPill } from '@antagna/ui';

type Tone = NonNullable<ComponentProps<typeof StatusPill>['tone']>;

export const PROJECT_STAGE_TONE: Record<string, Tone> = {
  lead: 'neutral',
  brief: 'info',
  quoted: 'info',
  approved: 'accent',
  planning: 'accent',
  shooting: 'warning',
  editing: 'warning',
  review: 'warning',
  delivered: 'success',
  archived: 'neutral',
  lost: 'danger',
  cancelled: 'danger',
};

export const PROJECT_STAGE_LABELS_AR: Record<string, string> = {
  lead: 'فرصة',
  brief: 'برِيف',
  quoted: 'مسعَّر',
  approved: 'موافَق عليه',
  planning: 'تخطيط',
  shooting: 'تصوير',
  editing: 'مونتاج',
  review: 'مراجعة',
  delivered: 'مُسلَّم',
  archived: 'أرشيف',
  lost: 'فاشل',
  cancelled: 'مُلغى',
};

export const PROJECT_STAGE_LABELS_EN: Record<string, string> = {
  lead: 'Lead',
  brief: 'Brief',
  quoted: 'Quoted',
  approved: 'Approved',
  planning: 'Planning',
  shooting: 'Shooting',
  editing: 'Editing',
  review: 'Review',
  delivered: 'Delivered',
  archived: 'Archived',
  lost: 'Lost',
  cancelled: 'Cancelled',
};

export const PROJECT_STAGE_ORDER = [
  'lead',
  'brief',
  'quoted',
  'approved',
  'planning',
  'shooting',
  'editing',
  'review',
  'delivered',
] as const;

export function stageTone(stage: string | null | undefined): Tone {
  if (!stage) return 'neutral';
  return PROJECT_STAGE_TONE[stage] ?? 'neutral';
}

/**
 * Arabic stage label. KEEP using this for anything PERSISTED (writeActivity
 * summaryAr, indexMemory, DB literals) — the audit/brain channel stays Arabic
 * regardless of the viewer's locale. For UI display use stageLabel(stage, locale).
 */
export function stageLabelAr(stage: string | null | undefined): string {
  if (!stage) return '—';
  return PROJECT_STAGE_LABELS_AR[stage] ?? stage;
}

/** Locale-aware DISPLAY label (falls back AR→key). Framework-agnostic: the
 *  caller supplies the locale (getLocale() in server, useLocale() in client). */
export function stageLabel(stage: string | null | undefined, locale: string): string {
  if (!stage) return '—';
  const map = locale === 'en' ? PROJECT_STAGE_LABELS_EN : PROJECT_STAGE_LABELS_AR;
  return map[stage] ?? PROJECT_STAGE_LABELS_AR[stage] ?? stage;
}
