/**
 * Per-event × per-channel notification preferences. Stored on
 * profiles.notification_prefs as { channels: { [eventKey]: ChannelPrefs } }.
 * The unified notification service (cross-cutting, future) reads this to decide
 * which channels to fan an event out to, in the recipient's ui_language.
 *
 * Server-safe (pure consts) so the page, the action, and the client matrix all
 * share one source of truth.
 */
export type Channel = 'inApp' | 'email' | 'whatsapp';
export type ChannelPrefs = Record<Channel, boolean>;

export const CHANNELS: { key: Channel; ar: string; en: string }[] = [
  { key: 'inApp', ar: 'داخل التطبيق', en: 'In-app' },
  { key: 'email', ar: 'البريد', en: 'Email' },
  { key: 'whatsapp', ar: 'واتساب', en: 'WhatsApp' },
];

export interface NotifEvent {
  key: string;
  ar: string;
  hintAr?: string;
  defaults: ChannelPrefs;
}

const all = (inApp: boolean, email: boolean, whatsapp: boolean): ChannelPrefs => ({
  inApp,
  email,
  whatsapp,
});

export const NOTIFICATION_EVENTS: NotifEvent[] = [
  {
    key: 'daily_digest',
    ar: 'الملخّص اليومي',
    hintAr: 'نشاط آخر 24 ساعة كل صباح',
    defaults: all(false, true, false),
  },
  {
    key: 'on_assignment',
    ar: 'عند إسنادك إلى مشروع أو مهمة',
    defaults: all(true, true, true),
  },
  {
    key: 'on_comment',
    ar: 'عند تعليق على عملك',
    defaults: all(true, true, false),
  },
  {
    key: 'on_deadline',
    ar: 'قرب موعد التسليم',
    hintAr: 'قبل 48 ساعة من الموعد',
    defaults: all(true, true, true),
  },
  {
    key: 'on_mention',
    ar: 'عند الإشارة إليك',
    defaults: all(true, false, true),
  },
  {
    key: 'on_alert',
    ar: 'تنبيهات النظام المهمة',
    hintAr: 'المخاطر والتنبيهات التشغيلية',
    defaults: all(true, true, true),
  },
];

export type NotifPrefs = { channels: Record<string, ChannelPrefs> };

/** Merge stored prefs over the defaults so new events appear with sane defaults. */
export function resolveNotifPrefs(stored: unknown): Record<string, ChannelPrefs> {
  const storedChannels =
    stored && typeof stored === 'object' && 'channels' in stored
      ? ((stored as NotifPrefs).channels ?? {})
      : {};
  const out: Record<string, ChannelPrefs> = {};
  for (const ev of NOTIFICATION_EVENTS) {
    const s = storedChannels[ev.key];
    out[ev.key] = {
      inApp: typeof s?.inApp === 'boolean' ? s.inApp : ev.defaults.inApp,
      email: typeof s?.email === 'boolean' ? s.email : ev.defaults.email,
      whatsapp: typeof s?.whatsapp === 'boolean' ? s.whatsapp : ev.defaults.whatsapp,
    };
  }
  return out;
}
