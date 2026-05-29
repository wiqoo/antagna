import type { ComponentType } from 'react';
import { Instagram, Youtube, Music, AtSign, Linkedin, Facebook, Ghost } from 'lucide-react';

/** Platform icon map — covers the social_platform enum. */
export const PLATFORM_ICON: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  instagram: Instagram,
  tiktok: Music,
  youtube: Youtube,
  x: AtSign,
  snapchat: Ghost,
  linkedin: Linkedin,
  facebook: Facebook,
};

export const PLATFORM_LABEL_AR: Record<string, string> = {
  instagram: 'إنستغرام',
  tiktok: 'تيك توك',
  youtube: 'يوتيوب',
  x: 'X (تويتر)',
  snapchat: 'سناب شات',
  linkedin: 'لينكدإن',
  facebook: 'فيسبوك',
};

export const POST_STATUS_LABEL_AR: Record<string, string> = {
  idea: 'فكرة',
  drafting: 'تحت الإعداد',
  in_review: 'مراجعة',
  scheduled: 'مجدول',
  published: 'منشور',
  promoted: 'مموّل',
  archived: 'مؤرشف',
  cancelled: 'ملغي',
};

export const POST_STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  idea: 'neutral',
  drafting: 'info',
  in_review: 'warning',
  scheduled: 'info',
  published: 'success',
  promoted: 'success',
  archived: 'neutral',
  cancelled: 'danger',
};

export const FORMAT_LABEL_AR: Record<string, string> = {
  feed_image: 'صورة',
  feed_carousel: 'كاروسيل',
  feed_video: 'فيديو',
  reel: 'ريل',
  story: 'ستوري',
  short: 'شورت',
  long_form_video: 'فيديو طويل',
  live: 'بث مباشر',
  text: 'نص',
};

export const DEAL_TYPE_LABEL_AR: Record<string, string> = {
  paid_post: 'منشور مدفوع',
  barter: 'مقايضة',
  affiliate: 'عمولة',
  long_term_ambassador: 'سفير دائم',
};

export const DEAL_STATUS_LABEL_AR: Record<string, string> = {
  draft: 'مسودة',
  agreed: 'متفق عليها',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
};

export const DEAL_STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  draft: 'neutral',
  agreed: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

export const ACCESS_TYPE_LABEL_AR: Record<string, string> = {
  full_admin: 'تحكم كامل',
  editor: 'محرر',
  analytics_only: 'تحليلات فقط',
  no_api: 'بدون API',
};

export const PLATFORMS = [
  'instagram',
  'tiktok',
  'youtube',
  'x',
  'snapchat',
  'linkedin',
  'facebook',
] as const;

export const POST_FORMATS = [
  'reel',
  'story',
  'feed_image',
  'feed_carousel',
  'feed_video',
  'short',
  'long_form_video',
  'live',
  'text',
] as const;

export function fmtNum(n: number | string | null | undefined): string {
  if (n == null || n === '') return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US').format(v);
}
