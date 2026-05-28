/**
 * Card metadata + the default production bento layout.
 *
 * `component` renders a card with its sample content (used by the library /
 * "add card" picker). The production dashboard maps id → real data itself in
 * page.tsx, so it doesn't go through `component`.
 *
 * `titleAr` is the clean human title used by the V6 "clean" card skin.
 */
import type { ComponentType } from 'react';
import type { CardSize, AILevel } from './utils';
import {
  CardAIBrief, CardAtRisk, CardHotLeads, CardSmartSuggestions, CardEmailTriage,
  CardNextActions, CardProjectHealth, CardBottleneck, CardClientSentiment,
  CardCapacityForecast, CardFollowups, CardTodayShoots, CardCashflow,
  CardMTDRevenue, CardOpenTasks, CardApprovals, CardEquipmentConflicts,
  CardEquipmentBattery, CardActivity, CardStaleConvos, CardLeadTemp, CardAICost,
  CardEmailSLA, CardVelocity, CardWinRate, CardOAuthHealth, CardWorkerStatus,
  CardAITip, CardGlance,
} from './cards';

export type CardComponent = ComponentType<{ size?: CardSize; editable?: boolean }>;

export type CatalogEntry = {
  id: string;
  title: string;
  titleAr: string;
  group: 'AI Heavy' | 'AI Medium' | 'AI Light' | 'No AI';
  ai: AILevel;
  component: CardComponent;
  defaultSize: CardSize;
  desc: string;
  /** true once the card is wired to a real data source in production. */
  live?: boolean;
};

export const CARD_CATALOG = [
  { id: 'glance', title: 'At a Glance', titleAr: 'لمحة سريعة', group: 'No AI', ai: 'none', component: CardGlance, defaultSize: 'sm', desc: 'مشاريع/مهام/leads/مراجعة في كرت واحد', live: true },
  { id: 'email_triage', title: 'Email Triage', titleAr: 'فرز الإيميلات', group: 'AI Heavy', ai: 'heavy', component: CardEmailTriage, defaultSize: 'md', desc: 'إيميلات مرتبة بـ AI حسب الأهمية', live: true },
  { id: 'ai_suggestions', title: 'Smart Suggestions', titleAr: 'اقتراحات ذكية', group: 'AI Heavy', ai: 'heavy', component: CardSmartSuggestions, defaultSize: 'md', desc: 'اقتراحات AI من الإيميل بانتظار مراجعتك', live: true },
  { id: 'project_health', title: 'Project Health Pulse', titleAr: 'صحة المشاريع', group: 'AI Heavy', ai: 'heavy', component: CardProjectHealth, defaultSize: 'lg', desc: 'R/A/G لكل مشروع نشط مع شرح AI', live: true },
  { id: 'capacity_fc', title: 'Capacity Forecast', titleAr: 'توقّع حمولة الفريق', group: 'AI Heavy', ai: 'heavy', component: CardCapacityForecast, defaultSize: 'lg', desc: 'AI يتوقع overload قبل ما يحصل', live: true },
  { id: 'approvals', title: 'Pending Approvals', titleAr: 'موافقات معلّقة', group: 'AI Medium', ai: 'medium', component: CardApprovals, defaultSize: 'md', desc: 'موافقات معلقة', live: true },
  { id: 'stale_convos', title: 'Stale Conversations', titleAr: 'محادثات متوقّفة', group: 'AI Heavy', ai: 'heavy', component: CardStaleConvos, defaultSize: 'md', desc: 'محادثات AI شاف إنها متوقفة', live: true },
  { id: 'shoots', title: "This Week's Shoots", titleAr: 'تصوير هذا الأسبوع', group: 'AI Light', ai: 'light', component: CardTodayShoots, defaultSize: 'md', desc: 'لقطات الأسبوع مع conflict detection', live: true },
  { id: 'equip_conflicts', title: 'Equipment Conflicts', titleAr: 'تعارضات المعدات', group: 'AI Light', ai: 'light', component: CardEquipmentConflicts, defaultSize: 'sm', desc: 'AI كشف overlaps في الحجوزات', live: true },
  { id: 'mtd_revenue', title: 'MTD Revenue', titleAr: 'إيراد الشهر', group: 'AI Light', ai: 'light', component: CardMTDRevenue, defaultSize: 'sm', desc: 'إيراد الشهر مع sparkline', live: true },
  { id: 'at_risk', title: 'At-Risk Projects', titleAr: 'مشاريع في خطر', group: 'AI Heavy', ai: 'heavy', component: CardAtRisk, defaultSize: 'md', desc: 'مشاريع AI شايف إنها هتفوت deadline', live: true },

  // Available in the library but not yet wired to real data (render sample).
  { id: 'ai_brief', title: 'AI Daily Brief', titleAr: 'ملخّص اليوم', group: 'AI Heavy', ai: 'heavy', component: CardAIBrief, defaultSize: 'lg', desc: 'أهم ٣-٥ أولويات اليوم (الهيرو فوق يغطيها)' },
  { id: 'hot_leads', title: 'Hot Leads', titleAr: 'Leads ساخنة', group: 'AI Heavy', ai: 'heavy', component: CardHotLeads, defaultSize: 'md', desc: 'leads بأعلى احتمال تحويل' },
  { id: 'next_actions', title: 'Do These Now', titleAr: 'افعلها الآن', group: 'AI Heavy', ai: 'heavy', component: CardNextActions, defaultSize: 'md', desc: '٣ خطوات AI شايف إنها priority الآن' },
  { id: 'bottleneck', title: 'Bottleneck Stage', titleAr: 'عنق الزجاجة', group: 'AI Heavy', ai: 'heavy', component: CardBottleneck, defaultSize: 'md', desc: 'AI يحدد المرحلة الأبطأ' },
  { id: 'client_mood', title: 'Client Sentiment', titleAr: 'مزاج العملاء', group: 'AI Heavy', ai: 'heavy', component: CardClientSentiment, defaultSize: 'md', desc: 'مزاج العميل من قراءة AI للإيميلات' },
  { id: 'followups', title: 'Draft Follow-ups', titleAr: 'متابعات جاهزة', group: 'AI Heavy', ai: 'heavy', component: CardFollowups, defaultSize: 'md', desc: 'مسودات إيميل AI جاهزة للإرسال' },
  { id: 'ai_tip', title: 'AI Tip of the Day', titleAr: 'نصيحة اليوم', group: 'AI Heavy', ai: 'heavy', component: CardAITip, defaultSize: 'md', desc: 'نمط جديد رصده الـ AI من تاريخ Volt' },
  { id: 'cashflow', title: 'Cashflow Forecast', titleAr: 'توقّع التدفّق النقدي', group: 'AI Medium', ai: 'medium', component: CardCashflow, defaultSize: 'md', desc: 'إيراد + توقع AI لنهاية الشهر' },
  { id: 'lead_temp', title: 'Lead Temperature', titleAr: 'حرارة الـ Leads', group: 'AI Medium', ai: 'medium', component: CardLeadTemp, defaultSize: 'sm', desc: 'توزيع الـ leads بالـ AI score' },
  { id: 'ai_cost', title: 'AI Cost Burn', titleAr: 'إنفاق الـ AI', group: 'AI Medium', ai: 'medium', component: CardAICost, defaultSize: 'sm', desc: 'إنفاق Anthropic + OpenAI الشهري' },
  { id: 'velocity', title: 'Project Velocity', titleAr: 'سرعة المشاريع', group: 'AI Medium', ai: 'medium', component: CardVelocity, defaultSize: 'md', desc: 'سرعة المشاريع مقارنة بالقاعدة' },
  { id: 'win_rate', title: 'Win Rate', titleAr: 'معدّل الفوز', group: 'AI Medium', ai: 'medium', component: CardWinRate, defaultSize: 'sm', desc: 'معدل الفوز بالعروض حسب نوع العميل' },
  { id: 'open_tasks', title: 'My Open Tasks', titleAr: 'مهامي المفتوحة', group: 'AI Light', ai: 'light', component: CardOpenTasks, defaultSize: 'md', desc: 'مهامي مرتبة بالـ AI urgency' },
  { id: 'activity', title: 'Activity Feed', titleAr: 'النشاط المباشر', group: 'AI Light', ai: 'light', component: CardActivity, defaultSize: 'md', desc: 'آخر الأحداث، AI يبرز المهم' },
  { id: 'battery', title: 'Battery Alerts', titleAr: 'تنبيهات البطارية', group: 'AI Light', ai: 'light', component: CardEquipmentBattery, defaultSize: 'sm', desc: 'AI يتوقع المعدات التي تحتاج شحناً' },
  { id: 'email_sla', title: 'Email Response SLA', titleAr: 'سرعة الرد (٢٤س)', group: 'No AI', ai: 'none', component: CardEmailSLA, defaultSize: 'sm', desc: '٪ الـ threads المردود عليها خلال ٢٤س' },
  { id: 'oauth_health', title: 'OAuth Health', titleAr: 'صحة الربط', group: 'No AI', ai: 'none', component: CardOAuthHealth, defaultSize: 'sm', desc: 'صحة tokens الـ Google/WhatsApp' },
  { id: 'workers', title: 'Worker Status', titleAr: 'حالة المهام', group: 'No AI', ai: 'none', component: CardWorkerStatus, defaultSize: 'sm', desc: 'Trigger.dev tasks status' },
] as const satisfies readonly CatalogEntry[];

export type CardId = (typeof CARD_CATALOG)[number]['id'];

export const CARD_BY_ID: Record<CardId, CatalogEntry> = Object.fromEntries(
  CARD_CATALOG.map((c) => [c.id, c]),
) as Record<CardId, CatalogEntry>;

// ── Layout ────────────────────────────────────────────────────────────────

export const DASH_LAYOUT_COOKIE = 'dash_layout';

export type DashLayout = {
  order: CardId[];
  sizes: Partial<Record<CardId, CardSize>>;
  hidden: CardId[];
};

/** Default production bento — order + per-card size. Everything not listed
 * here starts hidden (available via the customize picker). */
const DEFAULT_ORDER: CardId[] = [
  'glance', 'email_triage', 'ai_suggestions',
  'project_health', 'capacity_fc',
  'approvals', 'stale_convos', 'shoots',
  'equip_conflicts', 'mtd_revenue',
];

export const DEFAULT_LAYOUT: DashLayout = {
  order: DEFAULT_ORDER,
  sizes: {
    glance: 'sm', email_triage: 'md', ai_suggestions: 'md',
    project_health: 'lg', capacity_fc: 'lg',
    approvals: 'md', stale_convos: 'md', shoots: 'md',
    equip_conflicts: 'sm', mtd_revenue: 'sm',
    at_risk: 'md',
  },
  hidden: CARD_CATALOG.map((c) => c.id).filter((id) => !DEFAULT_ORDER.includes(id)),
};

/** Per-role lead cards — reorders the same default set so each role sees their
 * most relevant cards first. Applied only when the user has no saved layout. */
const ROLE_LEAD: Record<string, CardId[]> = {
  project_manager: ['project_health', 'capacity_fc', 'approvals', 'shoots'],
  production_manager: ['shoots', 'equip_conflicts', 'capacity_fc', 'project_health'],
  account_manager: ['ai_suggestions', 'email_triage', 'stale_convos', 'mtd_revenue'],
  finance: ['mtd_revenue', 'project_health', 'approvals'],
  hr: ['capacity_fc', 'glance'],
};

export function roleDefaultLayout(role?: string | null): DashLayout {
  const lead = role ? ROLE_LEAD[role] : undefined;
  if (!lead) return DEFAULT_LAYOUT;
  const order = [...lead, ...DEFAULT_ORDER.filter((id) => !lead.includes(id))];
  return { ...DEFAULT_LAYOUT, order };
}

/**
 * Merge a user's stored layout with the catalog: keep their order/sizes/hidden,
 * drop ids that no longer exist, and append any newly-shipped cards (hidden by
 * default so a deploy never silently rearranges someone's board).
 */
export function resolveLayout(
  stored?: Partial<DashLayout> | null,
  role?: string | null,
): DashLayout {
  if (!stored || !stored.order?.length) return roleDefaultLayout(role);

  const valid = new Set(CARD_CATALOG.map((c) => c.id) as CardId[]);
  const order = stored.order.filter((id): id is CardId => valid.has(id));
  const seen = new Set(order);

  for (const c of CARD_CATALOG) {
    if (!seen.has(c.id)) order.push(c.id);
  }

  const hidden = (stored.hidden ?? DEFAULT_LAYOUT.hidden).filter((id): id is CardId => valid.has(id));
  for (const c of CARD_CATALOG) {
    const wasKnown = stored.order?.includes(c.id) || stored.hidden?.includes(c.id);
    if (!wasKnown && DEFAULT_LAYOUT.hidden.includes(c.id) && !hidden.includes(c.id)) {
      hidden.push(c.id);
    }
  }

  const sizes: Partial<Record<CardId, CardSize>> = {};
  for (const id of order) {
    sizes[id] = stored.sizes?.[id] ?? CARD_BY_ID[id]?.defaultSize ?? 'md';
  }

  // Defensive fallback: if a corrupted cookie ends up hiding every card the
  // user has in their order, render the role default instead of a blank board.
  // (Mohammed's audit hit this — "briefing visible, every other card empty".)
  const hiddenSet = new Set(hidden);
  const wouldRenderAny = order.some((id) => !hiddenSet.has(id));
  if (!wouldRenderAny) return roleDefaultLayout(role);

  return { order, sizes, hidden };
}
