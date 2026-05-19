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

export function stageLabelAr(stage: string | null | undefined): string {
  if (!stage) return '—';
  return PROJECT_STAGE_LABELS_AR[stage] ?? stage;
}
