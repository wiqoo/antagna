import type { ComponentProps } from 'react';
import type { StatusPill } from '@antagna/ui';

type Tone = NonNullable<ComponentProps<typeof StatusPill>['tone']>;

/**
 * AI risk level (insights-scanner writes 'green' | 'amber' | 'red'). Previously
 * the raw enum was shown verbatim (so even Arabic mode displayed "amber"). This
 * is the shared glossary: tone + locale-aware label. "خطر" is intentionally
 * avoided per Mohammed's wording — amber reads "يحتاج انتباه".
 */
export const RISK_TONE: Record<string, Tone> = {
  red: 'danger',
  amber: 'warning',
  green: 'success',
};

export const RISK_LABELS_AR: Record<string, string> = {
  green: 'سليم',
  amber: 'يحتاج انتباه',
  red: 'حرِج',
};

export const RISK_LABELS_EN: Record<string, string> = {
  green: 'On track',
  amber: 'Needs attention',
  red: 'Critical',
};

export function riskTone(level: string | null | undefined): Tone {
  return (level && RISK_TONE[level]) || 'neutral';
}

export function riskLabel(level: string | null | undefined, locale: string): string {
  if (!level) return '—';
  const map = locale === 'en' ? RISK_LABELS_EN : RISK_LABELS_AR;
  return map[level] ?? level;
}
