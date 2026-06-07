/**
 * WhatsApp bot settings — types + constants (client-safe, no DB import).
 * The DB reader lives in whatsapp-settings.server.ts. Surfaced on
 * /admin/system?tab=whatsapp; the bot respects all of it on every inbound.
 */
export type WhatsappReplyMode = 'auto' | 'draft' | 'off';

export type WhatsappSettings = {
  /** Master switch — when false the bot never runs. */
  enabled: boolean;
  /** auto = send replies · draft = generate but DON'T send · off = never reply. */
  replyMode: WhatsappReplyMode;
  /** Position keys allowed to use the bot; ['*'] = every registered team member. */
  allowedPositions: string[];
  /** Extra persona / tone / rules appended to the system prompt. */
  persona: string;
  /** Per-tool enable flags (capability surface). */
  tools: Record<string, boolean>;
  provider: 'openai' | 'anthropic';
  model: string;
  maxTokens: number;
};

export const WHATSAPP_TOOLS: { key: string; label: string }[] = [
  { key: 'my_open_tasks', label: 'مهامي المفتوحة' },
  { key: 'project_status', label: 'حالة مشروع' },
  { key: 'lookup_colleague', label: 'بحث عن زميل' },
  { key: 'antagna_link', label: 'روابط Antagna' },
  { key: 'recent_activity', label: 'آخر النشاط' },
];

export const WHATSAPP_DEFAULTS: WhatsappSettings = {
  enabled: true,
  replyMode: 'auto',
  allowedPositions: ['*'],
  persona: '',
  tools: Object.fromEntries(WHATSAPP_TOOLS.map((t) => [t.key, true])),
  provider: 'openai',
  model: 'gpt-4o-mini',
  maxTokens: 400,
};
