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
  // capacity_fc (حمولة الفريق) retired — owner deemed it not useful + it was the
  // heaviest board query (14× generate_series fan-out). Not `live` → boardable()
  // drops it from every board.
  { id: 'capacity_fc', title: 'Capacity Forecast', titleAr: 'توقّع حمولة الفريق', group: 'AI Heavy', ai: 'heavy', component: CardCapacityForecast, defaultSize: 'lg', desc: 'AI يتوقع overload قبل ما يحصل' },
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
  'equip_conflicts',
  // mtd_revenue removed for the phase-1 launch (financials hidden). The
  // `boardable()` filter below keeps it (and any future money card) off every
  // default board until finance ships; re-add by relaxing PHASE1_HIDDEN_IDS.
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
 * most relevant cards first. Applied only when the user has no saved layout.
 *
 * `role` here is the legacy `profiles.role` value. Prefer `POSITION_LAYOUT`
 * (keyed by `profiles.position_key`) — this map is the fallback for profiles
 * that have no position_key yet. */
const ROLE_LEAD: Record<string, CardId[]> = {
  project_manager: ['project_health', 'capacity_fc', 'approvals', 'shoots'],
  production_manager: ['shoots', 'equip_conflicts', 'capacity_fc', 'project_health'],
  account_manager: ['ai_suggestions', 'email_triage', 'stale_convos', 'mtd_revenue'],
  finance: ['mtd_revenue', 'project_health', 'approvals'],
  hr: ['capacity_fc', 'glance'],
};

/**
 * Per-position dashboard card sets (permissions spec Part 7).
 *
 * Keyed by `profiles.position_key` (the 16 positions seeded in migration 049).
 * Each list is the spec's card order, mapped to catalog ids that exist TODAY.
 * Cards the spec names but the catalog doesn't have yet are tracked in the
 * `// follow-up:` comment on each line so a future card ships into the right
 * board automatically. The board is the listed cards (visible, in this order),
 * everything else hidden — so a videographer never sees revenue, a production
 * director never sees cash, etc., by construction.
 *
 * Position keys with no entry fall through to `ROLE_LEAD` then `DEFAULT_LAYOUT`.
 */
const POSITION_LAYOUT: Record<string, CardId[]> = {
  // GM — revenue, approvals, at-risk, cash. (brand_health, team_alerts = follow-up cards)
  general_manager: ['mtd_revenue', 'approvals', 'at_risk', 'cashflow', 'project_health'],
  // Production Director — capacity, shoots, equipment readiness, active projects,
  // AI queue, system health. Financial cards intentionally absent (spec NOT list).
  production_director: ['capacity_fc', 'shoots', 'battery', 'project_health', 'ai_suggestions', 'oauth_health', 'workers'],
  // Project Manager — my projects, pipeline, client responses, milestones, AI.
  project_manager: ['project_health', 'hot_leads', 'stale_convos', 'open_tasks', 'ai_suggestions'],
  // Account Manager — pipeline, brand responses, approvals waiting, this-month revenue.
  // (my_abu_luka_deals = follow-up card)
  account_manager: ['hot_leads', 'email_triage', 'stale_convos', 'approvals', 'mtd_revenue'],
  // Videographer — shoots, tasks. (my_editing_queue, equipment_assigned_to_me = follow-up)
  videographer: ['shoots', 'open_tasks', 'glance'],
  // Editors — same shape as videographer (editing queue is a follow-up card).
  video_editor: ['open_tasks', 'shoots', 'glance'],
  photo_editor: ['open_tasks', 'shoots', 'glance'],
  // Equipment Technician — shoots needing prep, conflicts, battery status.
  // (returns_due, maintenance_due, new_equipment = follow-up cards)
  equipment_technician: ['shoots', 'equip_conflicts', 'battery', 'glance'],
  // Procurement — every spec card (pending_pos, deliveries_today, vendor_payments_due,
  // low_stock_alerts) is a follow-up; show a neutral working board for now.
  procurement: ['glance', 'activity', 'open_tasks'],
  // Financial Manager — cash, margins to review, AI spend, MTD. (ar_aging,
  // upcoming_payments, month_closing_status, zatca_status = follow-up cards)
  financial_manager: ['cashflow', 'mtd_revenue', 'project_health', 'ai_cost', 'approvals'],
  // Accountant — cash + revenue placeholders; the spec's data-entry cards
  // (transactions_to_enter, bank_reconciliation_status, expense_reports_pending,
  // ar_calls_today, petty_cash_balance) are all follow-up cards.
  accountant: ['cashflow', 'mtd_revenue', 'glance'],
  // HR — capacity stand-in; every spec card (attendance_this_week,
  // leave_requests_pending, active_recruitments, upcoming_reviews,
  // compliance_alerts) is a follow-up card.
  hr_manager: ['capacity_fc', 'glance', 'activity'],
  // System Admin — operational health board.
  system_admin: ['oauth_health', 'workers', 'ai_cost', 'activity', 'glance'],
  // Trainee / Freelancer — minimal personal board.
  trainee: ['glance', 'open_tasks', 'shoots'],
  freelancer: ['glance', 'open_tasks', 'shoots'],
  // Creative Director — production-facing board (no financials).
  creative_director: ['ai_suggestions', 'project_health', 'shoots', 'capacity_fc', 'stale_convos'],
};

/** Card ids actually wired to real data in board.tsx (mirrors the catalog
 *  `live` flag). A board id outside this set is a phantom — the renderer drops
 *  it (it never gets a node), leaving a half-empty board. */
const LIVE_IDS = new Set<CardId>(
  (CARD_CATALOG as readonly CatalogEntry[])
    .filter((c) => c.live)
    .map((c) => c.id as CardId),
);

/** Financial cards hidden for the phase-1 launch (revenue / cash / AI-cost).
 *  Kept off every default board so no position shows money. Re-enable finance
 *  by trimming this set (and flipping FINANCIALS_HIDDEN). */
const PHASE1_HIDDEN_IDS = new Set<CardId>(['mtd_revenue', 'cashflow', 'ai_cost']);

/** A card may sit on a default board only when it renders real data AND isn't
 *  hidden for phase-1. Guarantees boards are never phantom-padded or money-leaky. */
function boardable(id: CardId): boolean {
  return LIVE_IDS.has(id) && !PHASE1_HIDDEN_IDS.has(id);
}

/** Neutral always-live cards used to pad a position board whose spec list is too
 *  thin once phantom/financial cards are filtered out. */
const FALLBACK_LIVE: CardId[] = [
  'glance', 'project_health', 'approvals', 'stale_convos', 'shoots',
];

/** Filter a card list to renderable cards, padding to ≥4 with neutral live ones
 *  (in order, no dups). The single guard that makes every default board solid. */
function boardableOrder(ids: readonly CardId[]): CardId[] {
  const out = ids.filter(boardable);
  for (const id of FALLBACK_LIVE) {
    if (out.length >= 4) break;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * The default board for a position. Spec Part 7 board if the position_key is
 * mapped; otherwise falls back to the legacy role lead, then DEFAULT_LAYOUT.
 * The position board is *exclusive* — only its (renderable, non-financial)
 * spec cards are visible, padded so no one ever lands on a half-empty board.
 */
export function positionDefaultLayout(
  positionKey?: string | null,
  role?: string | null,
): DashLayout {
  const lead = positionKey ? POSITION_LAYOUT[positionKey] : undefined;
  if (lead) {
    const order = boardableOrder(lead);
    const leadSet = new Set(order);
    const hidden = CARD_CATALOG.map((c) => c.id).filter((id) => !leadSet.has(id));
    const sizes: Partial<Record<CardId, CardSize>> = {};
    for (const id of order) sizes[id] = CARD_BY_ID[id]?.defaultSize ?? 'md';
    return { order, sizes, hidden };
  }
  return roleDefaultLayout(role);
}

export function roleDefaultLayout(role?: string | null): DashLayout {
  const lead = role ? ROLE_LEAD[role] : undefined;
  const base = lead
    ? [...lead, ...DEFAULT_ORDER.filter((id) => !lead.includes(id))]
    : DEFAULT_ORDER;
  const order = boardableOrder(base);
  const leadSet = new Set(order);
  const hidden = CARD_CATALOG.map((c) => c.id).filter((id) => !leadSet.has(id));
  const sizes: Partial<Record<CardId, CardSize>> = {};
  for (const id of order) sizes[id] = CARD_BY_ID[id]?.defaultSize ?? 'md';
  return { order, sizes, hidden };
}

/**
 * Merge a user's stored layout with the catalog: keep their order/sizes/hidden,
 * drop ids that no longer exist, and append any newly-shipped cards (hidden by
 * default so a deploy never silently rearranges someone's board).
 */
export function resolveLayout(
  stored?: Partial<DashLayout> | null,
  role?: string | null,
  positionKey?: string | null,
): DashLayout {
  if (!stored || !stored.order?.length) return positionDefaultLayout(positionKey, role);

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
  if (!wouldRenderAny) return positionDefaultLayout(positionKey, role);

  return { order, sizes, hidden };
}
