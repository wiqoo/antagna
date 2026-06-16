// Shared constants + pure helpers for the external-work module.

export type JobStatus =
  | 'draft'
  | 'in_progress'
  | 'review'
  | 'revisions'
  | 'delivered'
  | 'cancelled';

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  draft: 'مسودة',
  in_progress: 'قيد التنفيذ',
  review: 'مراجعة',
  revisions: 'تعديلات',
  delivered: 'تم التسليم',
  cancelled: 'ملغاة',
};

export const JOB_STATUS_TONE: Record<JobStatus, string> = {
  draft: 'var(--text-dim)',
  in_progress: 'var(--info)',
  review: 'var(--warning)',
  revisions: 'var(--warning)',
  delivered: 'var(--success)',
  cancelled: 'var(--text-dim)',
};

export const JOB_STATUS_ORDER: JobStatus[] = [
  'draft',
  'in_progress',
  'review',
  'revisions',
  'delivered',
  'cancelled',
];

export const PARTNER_KINDS = [
  { value: 'company', label: 'شركة' },
  { value: 'individual', label: 'فريلانسر' },
];

export const SPECIALTIES = [
  { value: 'edit', label: 'مونتاج' },
  { value: 'color', label: 'تصحيح ألوان' },
  { value: 'sound', label: 'هندسة صوت' },
  { value: 'motion', label: 'موشن جرافيك' },
  { value: 'vfx', label: 'مؤثرات / VFX' },
];

export const PAYMENT_METHODS = [
  { value: 'transfer', label: 'تحويل' },
  { value: 'cash', label: 'نقدي' },
  { value: 'other', label: 'أخرى' },
];

const SAR = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });
export const fmtSar = (n: number | null | undefined): string =>
  n == null ? '—' : SAR.format(Number(n));

export function jobStatusLabel(s: string | null): string {
  return (s && JOB_STATUS_LABEL[s as JobStatus]) || s || '—';
}
export function jobStatusTone(s: string | null): string {
  return (s && JOB_STATUS_TONE[s as JobStatus]) || 'var(--text-dim)';
}

export const SPECIALTY_LABEL: Record<string, string> = Object.fromEntries(
  SPECIALTIES.map((s) => [s.value, s.label]),
);

/** The completeness checklist — the guard against sending a partner half a job. */
export interface JobLike {
  brief: string | null;
  scope: string | null;
  partnerId: string | null;
  finalDueAt: Date | string | null;
  agreedAmountSar: string | number | null;
  materialCount: number;
}
export function checklist(j: JobLike): { key: string; label: string; ok: boolean }[] {
  return [
    { key: 'brief', label: 'البريف', ok: !!(j.brief && j.brief.trim()) },
    { key: 'scope', label: 'السكوب', ok: !!(j.scope && j.scope.trim()) },
    { key: 'material', label: 'لينك المادة', ok: j.materialCount > 0 },
    { key: 'deadline', label: 'موعد الفاينل', ok: !!j.finalDueAt },
    { key: 'partner', label: 'الشريك', ok: !!j.partnerId },
    { key: 'amount', label: 'المبلغ المتفق', ok: j.agreedAmountSar != null && Number(j.agreedAmountSar) > 0 },
  ];
}
export function isComplete(j: JobLike): boolean {
  return checklist(j).every((c) => c.ok);
}
