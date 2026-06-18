// Shared constants + helpers for the personal system.

export const PRIORITIES = [
  { value: 'high', label: 'عالية', tone: 'var(--danger)' },
  { value: 'normal', label: 'عادية', tone: 'var(--text-muted)' },
  { value: 'low', label: 'منخفضة', tone: 'var(--text-dim)' },
];
export const PRIORITY_TONE: Record<string, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p.tone]),
);
export const PRIORITY_LABEL: Record<string, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p.label]),
);

export const PROJECT_TYPES = [
  { value: 'work', label: 'شغل' },
  { value: 'personal', label: 'شخصي' },
];

// Work pipeline stages (personal projects ignore these).
export const STAGES = [
  { value: 'planning', label: 'تخطيط وبريف' },
  { value: 'shooting', label: 'تجهيز وتصوير' },
  { value: 'editing', label: 'مونتاج وإخراج' },
  { value: 'delivery', label: 'مراجعة وتسليم' },
];
export const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.value, s.label]),
);

export function todayRiyadh(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function dateAr(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' })
    : '';
}
